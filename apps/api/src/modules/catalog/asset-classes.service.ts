import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AssetClassSummary } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetClassDto, UpdateAssetClassDto } from './dto/catalog.dto';

@Injectable()
export class AssetClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AssetClassSummary[]> {
    const rows = await this.prisma.assetClass.findMany({
      orderBy: [{ sortOrder: 'asc' }, { labelEn: 'asc' }],
      include: { _count: { select: { assetTypes: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      labelEn: c.labelEn,
      labelAr: c.labelAr,
      fieldProfile: c.fieldProfile,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      typeCount: c._count.assetTypes,
    }));
  }

  async create(dto: CreateAssetClassDto) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (await this.prisma.assetClass.findFirst({ where: { code } })) {
      throw new ConflictException('Asset class code already exists');
    }
    return this.prisma.assetClass.create({
      data: {
        code,
        labelEn: dto.labelEn.trim(),
        labelAr: dto.labelAr?.trim() || null,
        fieldProfile: dto.fieldProfile ?? 'GENERIC',
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateAssetClassDto) {
    await this.ensure(id);
    return this.prisma.assetClass.update({
      where: { id },
      data: {
        ...(dto.labelEn !== undefined ? { labelEn: dto.labelEn.trim() } : {}),
        ...(dto.labelAr !== undefined ? { labelAr: dto.labelAr?.trim() || null } : {}),
        ...(dto.fieldProfile !== undefined ? { fieldProfile: dto.fieldProfile } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensure(id);
    const inUse = await this.prisma.assetType.count({ where: { assetClassId: id } });
    if (inUse > 0) throw new BadRequestException('Cannot delete a class assigned to asset types');
    await this.prisma.assetClass.delete({ where: { id } });
    return { id };
  }

  private async ensure(id: string) {
    const c = await this.prisma.assetClass.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Asset class not found');
    return c;
  }
}
