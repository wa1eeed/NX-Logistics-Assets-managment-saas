import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CONDITION_RANK, InspectionKind,
  type ChecklistEntry, type ConditionDiffEntry, type ConditionRating,
  type HandoverInspectionItem, type HandoverView,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { processUpload } from '../../utils/file-processing';
import { CreateInspectionDto } from './dto/handover.dto';

@Injectable()
export class HandoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createInspection(
    contractId: string,
    dto: CreateInspectionDto,
    actor: { id: string; role: string },
    ip: string | null,
  ): Promise<HandoverInspectionItem> {
    const contract = await this.prisma.rentalContract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Contract not found');

    const existing = await this.prisma.handoverInspection.findFirst({ where: { contractId, kind: dto.kind } });
    if (existing) throw new BadRequestException(`A ${dto.kind} inspection already exists for this contract`);
    if (dto.kind === InspectionKind.RETURN) {
      const receipt = await this.prisma.handoverInspection.findFirst({ where: { contractId, kind: InspectionKind.RECEIPT } });
      if (!receipt) throw new BadRequestException('Cannot record a RETURN inspection before a RECEIPT inspection');
    }

    const row = await this.prisma.handoverInspection.create({
      data: {
        contractId,
        kind: dto.kind,
        checklist: dto.checklist as unknown as Prisma.InputJsonValue,
        odometer: dto.odometer ?? null,
        photos: [],
        notes: dto.notes?.trim() || null,
        signedBy: dto.signedBy.trim(),
        signedByRole: dto.signedByRole?.trim() || actor.role,
        signedById: actor.id,
        ip,
        signedAt: new Date(),
      },
    });
    return this.toItem(row);
  }

  async addPhoto(inspectionId: string, file: Express.Multer.File | undefined): Promise<HandoverInspectionItem> {
    if (!file) throw new BadRequestException('File is required');
    const insp = await this.prisma.handoverInspection.findUnique({ where: { id: inspectionId } });
    if (!insp) throw new NotFoundException('Inspection not found');
    const processed = await processUpload(file);
    const key = this.storage.buildKey(`contracts/${insp.contractId}/inspections`, processed.fileName);
    await this.storage.putObject(key, processed.buffer, processed.contentType);
    const photos = [...(Array.isArray(insp.photos) ? (insp.photos as string[]) : []), key];
    const row = await this.prisma.handoverInspection.update({
      where: { id: inspectionId },
      data: { photos: photos as unknown as Prisma.InputJsonValue },
    });
    return this.toItem(row);
  }

  /** Returns receipt + return inspections and the deterioration diff. */
  async view(contractId: string): Promise<HandoverView> {
    const rows = await this.prisma.handoverInspection.findMany({ where: { contractId } });
    const receipt = rows.find((r) => r.kind === InspectionKind.RECEIPT) ?? null;
    const ret = rows.find((r) => r.kind === InspectionKind.RETURN) ?? null;

    const diff: ConditionDiffEntry[] = [];
    if (receipt && ret) {
      const rMap = new Map((receipt.checklist as unknown as ChecklistEntry[]).map((e) => [e.key, e.condition]));
      const tMap = new Map((ret.checklist as unknown as ChecklistEntry[]).map((e) => [e.key, e.condition]));
      const keys = new Set([...rMap.keys(), ...tMap.keys()]);
      for (const key of keys) {
        const rc = (rMap.get(key) ?? null) as ConditionRating | null;
        const tc = (tMap.get(key) ?? null) as ConditionRating | null;
        const deteriorated =
          rc != null && tc != null && CONDITION_RANK[rc] >= 0 && CONDITION_RANK[tc] >= 0 && CONDITION_RANK[tc] > CONDITION_RANK[rc];
        diff.push({ key, receipt: rc, return: tc, deteriorated });
      }
    }

    const odometerDelta = receipt?.odometer != null && ret?.odometer != null ? ret.odometer - receipt.odometer : null;
    return {
      contractId,
      receipt: receipt ? this.toItem(receipt) : null,
      return: ret ? this.toItem(ret) : null,
      diff,
      odometerDelta,
    };
  }

  /** Short-lived URL for a stored inspection photo. */
  async photoUrl(key: string): Promise<{ url: string }> {
    return { url: await this.storage.getSignedUrl(key) };
  }

  private toItem(r: {
    id: string; kind: string; checklist: Prisma.JsonValue; odometer: number | null; photos: Prisma.JsonValue;
    notes: string | null; signedBy: string | null; signedByRole: string | null; ip: string | null; signedAt: Date | null; createdAt: Date;
  }): HandoverInspectionItem {
    return {
      id: r.id,
      kind: r.kind as 'RECEIPT' | 'RETURN',
      checklist: Array.isArray(r.checklist) ? (r.checklist as unknown as ChecklistEntry[]) : [],
      odometer: r.odometer,
      photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
      notes: r.notes,
      signedBy: r.signedBy,
      signedByRole: r.signedByRole,
      ip: r.ip,
      signedAt: r.signedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
