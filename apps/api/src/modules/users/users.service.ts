import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { UserSummary } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { assertEmailNotPlatformOperator } from '../../common/email-uniqueness';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CreateUserDto, SetUserRolesDto, UpdateUserDto, RoleAssignmentDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        roles: { include: { role: true, orgUnit: true } },
      },
    });
    return users.map((u) => this.toSummary(u));
  }

  async getOne(id: string): Promise<UserSummary> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roles: { include: { role: true, orgUnit: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toSummary(user);
  }

  async create(dto: CreateUserDto): Promise<UserSummary> {
    // SaaS guardrail: enforce the tenant's active-user cap before creating.
    await this.entitlements.assertCanAddUser();

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');
    // Also reject an email owned by a platform operator (cross-table uniqueness).
    await assertEmailNotPlatformOperator(this.prisma, email);

    await this.validateAssignments(dto.roles ?? []);
    const passwordHash = await argon2.hash(dto.password);

    // Per-tenant human code (USR-NNNN). count() is tenant-scoped by middleware.
    const tenantId = currentTenantId();
    const seq = await this.prisma.user.count();
    const code = `USR-${String(seq + 1).padStart(4, '0')}`;

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        passwordHash,
        code,
        roles: dto.roles?.length
          ? {
              // nested creates aren't seen by the tenant middleware → stamp tenantId explicitly
              create: dto.roles.map((r) => ({
                roleId: r.roleId,
                orgUnitId: r.orgUnitId ?? null,
                tenantId,
              })),
            }
          : undefined,
      },
      include: { roles: { include: { role: true, orgUnit: true } } },
    });
    await this.entitlements.syncUsage();
    return this.toSummary(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserSummary> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await argon2.hash(dto.password);

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: { roles: { include: { role: true, orgUnit: true } } },
    });
    return this.toSummary(updated);
  }

  async setRoles(id: string, dto: SetUserRolesDto): Promise<UserSummary> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    await this.validateAssignments(dto.roles);

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: dto.roles.map((r) => ({
          userId: id,
          roleId: r.roleId,
          orgUnitId: r.orgUnitId ?? null,
        })),
        skipDuplicates: true,
      }),
    ]);

    return this.getOne(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.entitlements.syncUsage();
    return { id };
  }

  private async validateAssignments(roles: RoleAssignmentDto[]): Promise<void> {
    if (roles.length === 0) return;
    const roleIds = [...new Set(roles.map((r) => r.roleId))];
    const found = await this.prisma.role.count({ where: { id: { in: roleIds } } });
    if (found !== roleIds.length) throw new BadRequestException('One or more roles do not exist');

    const orgIds = [...new Set(roles.map((r) => r.orgUnitId).filter((x): x is string => !!x))];
    if (orgIds.length) {
      const foundOrg = await this.prisma.orgUnit.count({
        where: { id: { in: orgIds }, deletedAt: null },
      });
      if (foundOrg !== orgIds.length) {
        throw new BadRequestException('One or more org units do not exist');
      }
    }
  }

  private toSummary(u: {
    id: string;
    code: string | null;
    email: string;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
    roles: { id: string; roleId: string; orgUnitId: string | null; role: { name: string }; orgUnit: { name: string } | null }[];
  }): UserSummary {
    return {
      id: u.id,
      code: u.code,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      roles: u.roles.map((r) => ({
        id: r.id,
        roleId: r.roleId,
        roleName: r.role.name,
        orgUnitId: r.orgUnitId,
        orgUnitName: r.orgUnit?.name ?? null,
      })),
    };
  }
}
