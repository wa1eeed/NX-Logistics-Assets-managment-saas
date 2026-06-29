import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { IntegrationRequestDto, IntegrationStatus } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * Integration / customization requests (WASL et al). Tenant-raised, platform-fulfilled.
 * Activation is manual (status lifecycle); once ACTIVE the tenant may use the
 * matching LocationProvider (e.g. register WASL-sourced tracking devices).
 */
@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenant(): string {
    const id = currentTenantId();
    if (!id) throw new ForbiddenException('No tenant context');
    return id;
  }

  async create(user: AuthenticatedUser, dto: { type?: string; notes?: string }): Promise<IntegrationRequestDto> {
    const tenantId = this.requireTenant();
    const type = (dto.type ?? 'WASL').toUpperCase();
    // Avoid duplicate open requests of the same type.
    const open = await this.prisma.integrationRequest.findFirst({
      where: { type, status: { in: ['REQUESTED', 'UNDER_REVIEW', 'IN_SETUP'] } },
    });
    if (open) throw new BadRequestException('An open request of this type already exists');
    const r = await this.prisma.integrationRequest.create({
      data: { tenantId, type, status: 'REQUESTED', requestedBy: user.id, notes: dto.notes?.trim() || null },
    });
    return this.toDto(r, null);
  }

  async listMine(): Promise<IntegrationRequestDto[]> {
    this.requireTenant();
    const rows = await this.prisma.integrationRequest.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toDto(r, null));
  }

  async cancel(id: string): Promise<IntegrationRequestDto> {
    this.requireTenant();
    const r = await this.prisma.integrationRequest.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    if (['ACTIVE', 'REJECTED', 'CANCELLED'].includes(r.status)) throw new BadRequestException('Request can no longer be cancelled');
    const updated = await this.prisma.integrationRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    return this.toDto(updated, null);
  }

  // ---- platform (cross-tenant) ----

  async listAll(): Promise<IntegrationRequestDto[]> {
    const rows = await this.prisma.integrationRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter((x): x is string => !!x))];
    const tenants = tenantIds.length ? await this.prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, code: true } }) : [];
    const codeById = new Map(tenants.map((t) => [t.id, t.code]));
    return rows.map((r) => this.toDto(r, r.tenantId ? codeById.get(r.tenantId) ?? null : null));
  }

  async setStatus(id: string, status: IntegrationStatus, user: AuthenticatedUser): Promise<IntegrationRequestDto> {
    const r = await this.prisma.integrationRequest.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    const updated = await this.prisma.integrationRequest.update({ where: { id }, data: { status, handledBy: user.id } });
    return this.toDto(updated, null);
  }

  private toDto(r: {
    id: string; tenantId: string | null; type: string; status: string; requestedBy: string | null;
    notes: string | null; handledBy: string | null; createdAt: Date; updatedAt: Date;
  }, tenantCode: string | null): IntegrationRequestDto {
    return {
      id: r.id, tenantId: r.tenantId, tenantCode, type: r.type, status: r.status as IntegrationStatus,
      requestedBy: r.requestedBy, notes: r.notes, handledBy: r.handledBy,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  }
}
