import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LOOKUP_TYPE_KEYS, type LookupItem } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLookupDto, UpdateLookupDto } from './dto/lookup.dto';

@Injectable()
export class LookupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List entries. activeOnly=true is used by dropdowns; admin UI sees all. */
  async list(type?: string, activeOnly = false): Promise<LookupItem[]> {
    const rows = await this.prisma.lookup.findMany({
      where: { ...(type ? { type } : {}), ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { labelEn: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id, type: r.type, value: r.value, labelEn: r.labelEn,
      labelAr: r.labelAr, sortOrder: r.sortOrder, isActive: r.isActive,
    }));
  }

  async create(dto: CreateLookupDto): Promise<LookupItem> {
    if (!LOOKUP_TYPE_KEYS.includes(dto.type)) throw new BadRequestException('Unknown lookup type');
    const value = (dto.value?.trim() || dto.labelEn.trim());
    const existing = await this.prisma.lookup.findFirst({ where: { type: dto.type, value } });
    if (existing) throw new ConflictException('Value already exists for this list');
    const row = await this.prisma.lookup.create({
      data: {
        type: dto.type,
        value,
        labelEn: dto.labelEn.trim(),
        labelAr: dto.labelAr?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.toItem(row);
  }

  async update(id: string, dto: UpdateLookupDto): Promise<LookupItem> {
    await this.ensure(id);
    const row = await this.prisma.lookup.update({
      where: { id },
      data: {
        ...(dto.labelEn !== undefined ? { labelEn: dto.labelEn.trim() } : {}),
        ...(dto.labelAr !== undefined ? { labelAr: dto.labelAr?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toItem(row);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensure(id);
    await this.prisma.lookup.delete({ where: { id } });
    return { id };
  }

  private async ensure(id: string) {
    const l = await this.prisma.lookup.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Lookup not found');
    return l;
  }

  private toItem(r: { id: string; type: string; value: string; labelEn: string; labelAr: string | null; sortOrder: number; isActive: boolean }): LookupItem {
    return { id: r.id, type: r.type, value: r.value, labelEn: r.labelEn, labelAr: r.labelAr, sortOrder: r.sortOrder, isActive: r.isActive };
  }
}
