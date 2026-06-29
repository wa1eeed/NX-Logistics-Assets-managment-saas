import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrgUnitNode } from '@nx-lam/shared';
import { OrgUnitKind } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrgUnitDto, UpdateOrgUnitDto } from './dto/org-unit.dto';

@Injectable()
export class OrgUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async tree(): Promise<OrgUnitNode[]> {
    const flat = await this.prisma.orgUnit.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const nodeById = new Map<string, OrgUnitNode>();
    for (const u of flat) {
      nodeById.set(u.id, {
        id: u.id,
        name: u.name,
        kind: u.kind as OrgUnitKind,
        parentId: u.parentId,
        managerId: u.managerId,
        isActive: u.isActive,
        children: [],
      });
    }

    const roots: OrgUnitNode[] = [];
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async create(dto: CreateOrgUnitDto) {
    if (dto.parentId) {
      const parent = await this.prisma.orgUnit.findFirst({
        where: { id: dto.parentId, deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Parent org unit not found');
    }
    return this.prisma.orgUnit.create({
      data: {
        name: dto.name.trim(),
        kind: dto.kind,
        parentId: dto.parentId ?? null,
        managerId: dto.managerId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateOrgUnitDto) {
    await this.ensureExists(id);

    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('An org unit cannot be its own parent');
      const descendants = await this.descendantIds(id);
      if (descendants.has(dto.parentId)) {
        throw new BadRequestException('Cannot move a unit under its own descendant');
      }
      const parent = await this.prisma.orgUnit.findFirst({
        where: { id: dto.parentId, deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Parent org unit not found');
    }

    return this.prisma.orgUnit.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.ensureExists(id);
    const childCount = await this.prisma.orgUnit.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete a unit that has child units');
    }
    await this.prisma.orgUnit.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { id };
  }

  private async ensureExists(id: string) {
    const u = await this.prisma.orgUnit.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new NotFoundException('Org unit not found');
    return u;
  }

  private async descendantIds(rootId: string): Promise<Set<string>> {
    const all = await this.prisma.orgUnit.findMany({
      where: { deletedAt: null },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const u of all) {
      if (!u.parentId) continue;
      const list = childrenByParent.get(u.parentId) ?? [];
      list.push(u.id);
      childrenByParent.set(u.parentId, list);
    }
    const result = new Set<string>();
    const stack = [...(childrenByParent.get(rootId) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (result.has(id)) continue;
      result.add(id);
      for (const c of childrenByParent.get(id) ?? []) stack.push(c);
    }
    return result;
  }
}
