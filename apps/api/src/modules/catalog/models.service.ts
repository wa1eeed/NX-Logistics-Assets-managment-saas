import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ModelSummary } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateModelDto, ModelQueryDto, UpdateModelDto } from './dto/catalog.dto';

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ModelQueryDto): Promise<ModelSummary[]> {
    const where: Prisma.ModelWhereInput = {
      ...(query.manufacturer ? { manufacturer: query.manufacturer } : {}),
      ...(query.assetTypeId ? { assetTypeId: query.assetTypeId } : {}),
      ...(query.assetClass ? { assetType: { assetClass: { code: query.assetClass } } } : {}),
    };
    const rows = await this.prisma.model.findMany({
      where,
      orderBy: [{ manufacturer: 'asc' }, { name: 'asc' }],
      include: {
        assetType: { include: { assetClass: { select: { code: true } } } },
        _count: { select: { assets: true } },
      },
    });
    return rows.map((m) => ({
      id: m.id,
      manufacturer: m.manufacturer,
      name: m.name,
      category: m.category,
      assetTypeId: m.assetTypeId,
      assetTypeName: m.assetType.name,
      assetClassCode: m.assetType.assetClass?.code ?? null,
      isActive: m.isActive,
      assetCount: m._count.assets,
    }));
  }

  async create(dto: CreateModelDto) {
    const manufacturer = dto.manufacturer.trim();
    const name = dto.name.trim();
    if (await this.prisma.model.findFirst({ where: { manufacturer, name } })) {
      throw new ConflictException('A model with this brand + name already exists');
    }
    if (!(await this.prisma.assetType.findUnique({ where: { id: dto.assetTypeId } }))) {
      throw new BadRequestException('Asset type not found');
    }
    return this.prisma.model.create({
      data: {
        manufacturer,
        name,
        category: dto.category?.trim() || null,
        assetTypeId: dto.assetTypeId,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateModelDto) {
    await this.ensure(id);
    return this.prisma.model.update({
      where: { id },
      data: {
        ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.assetTypeId !== undefined ? { assetTypeId: dto.assetTypeId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensure(id);
    const inUse = await this.prisma.asset.count({ where: { modelId: id } });
    if (inUse > 0) throw new BadRequestException('Cannot delete a model that is in use by assets');
    await this.prisma.model.delete({ where: { id } });
    return { id };
  }

  private async ensure(id: string) {
    const m = await this.prisma.model.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Model not found');
    return m;
  }
}
