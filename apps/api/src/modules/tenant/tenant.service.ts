import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantBranding, TenantMe, TenantProfile } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { currentTenantId } from '../../common/tenant/tenant-context';
import { UpdateBrandingDto, UpdateProfileDto } from './dto/branding.dto';

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

/** Per-tenant profile + branding for the signed-in company. */
@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private requireTenant(): string {
    const id = currentTenantId();
    if (!id) throw new ForbiddenException('No tenant context');
    return id;
  }

  /** The signed-in user's tenant, incl. branding (logo as a short-lived URL) + company profile. */
  async me(): Promise<TenantMe> {
    const id = this.requireTenant();
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tenant not found');
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      status: t.status,
      branding: await this.brandingOf(t),
      profile: this.profileOf(t),
    };
  }

  /** Update the company account / tax-invoice profile fields. */
  async updateProfile(dto: UpdateProfileDto): Promise<TenantProfile> {
    const id = this.requireTenant();
    const clean = (v?: string | null) => (v === undefined ? undefined : v?.trim() || null);
    const t = await this.prisma.tenant.update({
      where: { id },
      data: {
        legalName: clean(dto.legalName),
        email: clean(dto.email),
        contactPhone: clean(dto.contactPhone),
        city: clean(dto.city),
        crNumber: clean(dto.crNumber),
        vatNumber: clean(dto.vatNumber),
      },
    });
    return this.profileOf(t);
  }

  private profileOf(t: {
    name: string; legalName: string | null; email: string | null; contactPhone: string | null;
    city: string | null; crNumber: string | null; vatNumber: string | null;
  }): TenantProfile {
    return {
      name: t.name,
      legalName: t.legalName ?? null,
      email: t.email ?? null,
      contactPhone: t.contactPhone ?? null,
      city: t.city ?? null,
      crNumber: t.crNumber ?? null,
      vatNumber: t.vatNumber ?? null,
    };
  }

  async updateBranding(dto: UpdateBrandingDto): Promise<TenantBranding> {
    const id = this.requireTenant();
    const t = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.brandName !== undefined ? { brandName: dto.brandName?.trim() || null } : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor || null } : {}),
      },
    });
    return this.brandingOf(t);
  }

  async setLogo(file?: Express.Multer.File): Promise<TenantBranding> {
    const id = this.requireTenant();
    if (!file) throw new BadRequestException('No file uploaded');
    if (!LOGO_TYPES.has(file.mimetype)) throw new BadRequestException('Logo must be PNG, JPEG, WebP or SVG');
    if (file.size > LOGO_MAX_BYTES) throw new BadRequestException('Logo must be 2 MB or smaller');

    const current = await this.prisma.tenant.findUnique({ where: { id } });
    const key = this.storage.buildKey('branding', file.originalname);
    await this.storage.putObject(key, file.buffer, file.mimetype);
    // Best-effort cleanup of the previous logo.
    if (current?.logoKey) await this.storage.deleteObject(current.logoKey).catch(() => undefined);

    const t = await this.prisma.tenant.update({ where: { id }, data: { logoKey: key } });
    return this.brandingOf(t);
  }

  private async brandingOf(t: { brandName: string | null; primaryColor: string | null; logoKey: string | null }): Promise<TenantBranding> {
    return {
      brandName: t.brandName ?? null,
      primaryColor: t.primaryColor ?? null,
      logoUrl: t.logoKey ? await this.storage.getSignedUrl(t.logoKey).catch(() => null) : null,
    };
  }
}
