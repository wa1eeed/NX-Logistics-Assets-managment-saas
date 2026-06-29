import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AssetTypeSummary } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetTypeDto, UpdateAssetTypeDto } from './dto/asset-type.dto';

@Injectable()
export class AssetTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AssetTypeSummary[]> {
    const types = await this.prisma.assetType.findMany({
      orderBy: { name: 'asc' },
      include: { assetClass: { select: { code: true } }, _count: { select: { assets: true } } },
    });
    return types.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      unit: t.unit,
      specs: (t.specs as Record<string, unknown> | null) ?? null,
      customFields: (t.customFields as never) ?? [],
      assetClassId: t.assetClassId,
      assetClassCode: t.assetClass?.code ?? null,
      assetCount: t._count.assets,
    }));
  }

  async create(dto: CreateAssetTypeDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.assetType.findFirst({ where: { name } });
    if (existing) throw new ConflictException('Asset type name already exists');
    return this.prisma.assetType.create({
      data: {
        name,
        category: dto.category?.trim() || null,
        unit: dto.unit?.trim() || null,
        assetClassId: dto.assetClassId ?? null,
        specs: dto.specs ? (dto.specs as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateAssetTypeDto) {
    await this.ensureExists(id);
    return this.prisma.assetType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit?.trim() || null } : {}),
        ...(dto.assetClassId !== undefined ? { assetClassId: dto.assetClassId || null } : {}),
        ...(dto.specs !== undefined
          ? { specs: dto.specs === null ? Prisma.JsonNull : (dto.specs as Prisma.InputJsonValue) }
          : {}),
        ...(dto.customFields !== undefined
          ? { customFields: dto.customFields === null ? Prisma.JsonNull : (dto.customFields as unknown as Prisma.InputJsonValue) }
          : {}),
      },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    const assetCount = await this.prisma.asset.count({ where: { assetTypeId: id } });
    if (assetCount > 0) {
      throw new BadRequestException('Cannot delete an asset type that is in use by assets');
    }
    await this.prisma.assetType.delete({ where: { id } });
    return { id };
  }

  private async ensureExists(id: string) {
    const t = await this.prisma.assetType.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Asset type not found');
    return t;
  }
}
