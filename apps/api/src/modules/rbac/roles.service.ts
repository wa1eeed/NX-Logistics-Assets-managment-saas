import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleSummary } from '@nx-lam/shared';
import { RoleName } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoleSummary[]> {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissionKeys: r.permissions.map((p) => p.permission.key).sort(),
      userCount: r._count.users,
    }));
  }

  async create(dto: CreateRoleDto): Promise<RoleSummary> {
    const name = dto.name.trim().toUpperCase().replace(/\s+/g, '_');
    // Role names are unique PER TENANT — findFirst is scoped to the caller's tenant.
    const existing = await this.prisma.role.findFirst({ where: { name } });
    if (existing) throw new ConflictException('Role name already exists');
    const role = await this.prisma.role.create({
      data: { name, description: dto.description?.trim() },
    });
    return { id: role.id, name: role.name, description: role.description, permissionKeys: [], userCount: 0 };
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleSummary> {
    await this.ensureExists(id);
    await this.prisma.role.update({ where: { id }, data: { description: dto.description?.trim() } });
    return this.getOne(id);
  }

  async setPermissions(id: string, dto: SetRolePermissionsDto): Promise<RoleSummary> {
    const role = await this.ensureExists(id);

    // SUPER_ADMIN must always retain full control over RBAC itself.
    if (role.name === RoleName.SUPER_ADMIN) {
      const must = ['users.read', 'roles.read', 'roles.manage'];
      const missing = must.filter((k) => !dto.permissionKeys.includes(k));
      if (missing.length) {
        throw new BadRequestException(
          `SUPER_ADMIN cannot drop core permissions: ${missing.join(', ')}`,
        );
      }
    }

    const perms = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
      select: { id: true, key: true },
    });
    if (perms.length !== dto.permissionKeys.length) {
      const known = new Set(perms.map((p) => p.key));
      const unknown = dto.permissionKeys.filter((k) => !known.has(k));
      throw new BadRequestException(`Unknown permission keys: ${unknown.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
        skipDuplicates: true,
      }),
    ]);

    return this.getOne(id);
  }

  async getOne(id: string): Promise<RoleSummary> {
    const r = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!r) throw new NotFoundException('Role not found');
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      permissionKeys: r.permissions.map((p) => p.permission.key).sort(),
      userCount: r._count.users,
    };
  }

  private async ensureExists(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
