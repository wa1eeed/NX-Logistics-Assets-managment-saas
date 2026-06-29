import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetStatus, DocumentEntityType, MaintenanceType, WorkOrderStatus,
  type AssetDocumentItem, type MaintenanceCardData, type MaintenancePart,
  type WorkOrderDetail, type WorkOrderSummary,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetStatusService } from '../assets/asset-status.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { processUpload } from '../../utils/file-processing';
import { nextRefNo } from '../../common/refno';
import {
  CloseWorkOrderDto, CreateWorkOrderDto, UpdateCardDto, WorkOrderQueryDto,
} from './dto/maintenance.dto';

const dec = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetStatus: AssetStatusService,
    private readonly storage: StorageService,
  ) {}

  async list(query: WorkOrderQueryDto): Promise<WorkOrderSummary[]> {
    const where: Prisma.MaintenanceWorkOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
    };
    const rows = await this.prisma.maintenanceWorkOrder.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      include: {
        asset: { include: { assetType: true } },
        card: { select: { id: true } },
        _count: { select: { documents: true } },
      },
    });
    return rows.map((w) => this.toSummary(w));
  }

  async getDetail(id: string): Promise<WorkOrderDetail> {
    const w = await this.prisma.maintenanceWorkOrder.findUnique({
      where: { id },
      include: {
        asset: { include: { assetType: true } },
        card: true,
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        _count: { select: { documents: true } },
      },
    });
    if (!w) throw new NotFoundException('Work order not found');

    const documents: AssetDocumentItem[] = w.documents.map((d) => ({
      id: d.id, docType: d.docType, fileName: d.fileName,
      expiryDate: d.expiryDate?.toISOString() ?? null, createdAt: d.createdAt.toISOString(), uploadedBy: d.uploadedBy,
    }));

    return { ...this.toSummary(w), card: this.toCard(w.card), documents };
  }

  async create(dto: CreateWorkOrderDto, userId: string): Promise<WorkOrderDetail> {
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, deletedAt: null } });
    if (!asset) throw new BadRequestException('Asset not found');
    const w = await this.prisma.maintenanceWorkOrder.create({
      data: {
        refNo: await nextRefNo(this.prisma, 'maintenanceWorkOrder', 'WO'),
        assetId: dto.assetId,
        source: dto.source,
        type: dto.type ?? MaintenanceType.CORRECTIVE,
        priority: dto.priority?.trim() || null,
        description: dto.description?.trim() || null,
        openedBy: userId,
      },
    });
    return this.getDetail(w.id);
  }

  async start(id: string, userId: string): Promise<WorkOrderDetail> {
    const w = await this.getOrThrow(id);
    if (w.status !== WorkOrderStatus.OPEN) throw new BadRequestException('Only open work orders can be started');
    await this.prisma.maintenanceWorkOrder.update({ where: { id }, data: { status: WorkOrderStatus.IN_PROGRESS } });
    // Asset goes Under Maintenance (allowed from AVAILABLE or IN_DUTY).
    await this.assetStatus.changeStatus(w.assetId, AssetStatus.UNDER_MAINTENANCE, userId, { reason: `Work order ${id} started` });
    return this.getDetail(id);
  }

  async updateCard(id: string, dto: UpdateCardDto, _userId: string): Promise<WorkOrderDetail> {
    const w = await this.getOrThrow(id);
    if (w.status === WorkOrderStatus.CLOSED || w.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit the card of a closed/cancelled work order');
    }
    const data = {
      worksDone: dto.worksDone ?? undefined,
      parts: dto.parts ? (dto.parts as unknown as Prisma.InputJsonValue) : undefined,
      technician: dto.technician ?? undefined,
      laborHours: dto.laborHours ?? undefined,
    };
    await this.prisma.maintenanceCard.upsert({
      where: { workOrderId: id },
      create: { workOrderId: id, ...data },
      update: data,
    });
    return this.getDetail(id);
  }

  async close(id: string, dto: CloseWorkOrderDto, userId: string): Promise<WorkOrderDetail> {
    const w = await this.getOrThrow(id);
    if (w.status !== WorkOrderStatus.IN_PROGRESS) throw new BadRequestException('Only in-progress work orders can be closed');
    await this.prisma.maintenanceWorkOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.CLOSED,
        totalCost: dto.totalCost ?? null,
        closedBy: userId,
        closedAt: new Date(),
      },
    });
    // Asset returns to service.
    const asset = await this.prisma.asset.findUnique({ where: { id: w.assetId } });
    if (asset?.status === AssetStatus.UNDER_MAINTENANCE) {
      await this.assetStatus.changeStatus(w.assetId, AssetStatus.AVAILABLE, userId, { reason: `Work order ${id} closed` });
    }
    return this.getDetail(id);
  }

  async cancel(id: string, userId: string): Promise<WorkOrderDetail> {
    const w = await this.getOrThrow(id);
    if (w.status === WorkOrderStatus.CLOSED || w.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('Work order already finalized');
    }
    await this.prisma.maintenanceWorkOrder.update({ where: { id }, data: { status: WorkOrderStatus.CANCELLED } });
    const asset = await this.prisma.asset.findUnique({ where: { id: w.assetId } });
    if (w.status === WorkOrderStatus.IN_PROGRESS && asset?.status === AssetStatus.UNDER_MAINTENANCE) {
      await this.assetStatus.changeStatus(w.assetId, AssetStatus.AVAILABLE, userId, { reason: `Work order ${id} cancelled` });
    }
    return this.getDetail(id);
  }

  async uploadDocument(
    id: string,
    file: Express.Multer.File | undefined,
    docType: string,
    userId: string,
  ): Promise<AssetDocumentItem> {
    if (!file) throw new BadRequestException('File is required');
    const w = await this.getOrThrow(id);
    const processed = await processUpload(file);
    const key = this.storage.buildKey(`work-orders/${id}`, processed.fileName);
    await this.storage.putObject(key, processed.buffer, processed.contentType);
    const doc = await this.prisma.document.create({
      data: {
        entityType: DocumentEntityType.WORK_ORDER,
        workOrderId: w.id,
        docType: docType.trim() || 'Invoice',
        fileKey: key,
        fileName: processed.fileName,
        uploadedBy: userId,
      },
    });
    return {
      id: doc.id, docType: doc.docType, fileName: doc.fileName,
      expiryDate: null, createdAt: doc.createdAt.toISOString(), uploadedBy: doc.uploadedBy,
    };
  }

  private async getOrThrow(id: string) {
    const w = await this.prisma.maintenanceWorkOrder.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Work order not found');
    return w;
  }

  private toSummary(
    w: Prisma.MaintenanceWorkOrderGetPayload<{
      include: { asset: { include: { assetType: true } }; card: { select: { id: true } }; _count: { select: { documents: true } } };
    }> | Prisma.MaintenanceWorkOrderGetPayload<{
      include: { asset: { include: { assetType: true } }; card: true; documents: true; _count: { select: { documents: true } } };
    }>,
  ): WorkOrderSummary {
    return {
      id: w.id,
      refNo: w.refNo,
      assetId: w.assetId,
      assetCode: w.asset.code,
      assetTypeName: w.asset.assetType.name,
      source: w.source as WorkOrderSummary['source'],
      type: w.type as WorkOrderSummary['type'],
      status: w.status as WorkOrderStatus,
      priority: w.priority,
      description: w.description,
      totalCost: dec(w.totalCost),
      hasCard: !!w.card,
      documentCount: w._count.documents,
      openedBy: w.openedBy,
      closedBy: w.closedBy,
      openedAt: w.openedAt.toISOString(),
      closedAt: w.closedAt?.toISOString() ?? null,
    };
  }

  private toCard(card: { worksDone: Prisma.JsonValue; parts: Prisma.JsonValue; technician: string | null; laborHours: Prisma.Decimal | null } | null): MaintenanceCardData | null {
    if (!card) return null;
    return {
      worksDone: typeof card.worksDone === 'string' ? card.worksDone : null,
      parts: Array.isArray(card.parts) ? (card.parts as unknown as MaintenancePart[]) : [],
      technician: card.technician,
      laborHours: dec(card.laborHours),
    };
  }
}
