import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {
  DEFAULT_ENABLED_MODULES, DEFAULT_MAX_STORAGE_BYTES, DEFAULT_MAX_USER_COUNT, DEFAULT_SEAT_PRICE, RoleName,
  type AuthTokens, type LoginResponse, type RegisterCompanyDto,
} from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from './access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { assertEmailNotPlatformOperator } from '../../common/email-uniqueness';
import { provisionTenantRoles } from '../rbac/provision-roles';

interface RefreshTokenPayload {
  sub: string;
  kind: 'tenant' | 'platform';
  type: 'refresh';
}

/** Dummy hash used to keep login timing roughly constant on a missing account. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$invalidsaltinvalidsalt$invalidhashinvalidhashinvalidhashinvalidhash00';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const normalized = email.toLowerCase().trim();

    // 1) Tenant (company) user.
    const user = await this.prisma.user.findFirst({ where: { email: normalized, deletedAt: null } });
    if (user) {
      const valid = await this.verifyPassword(user.passwordHash, password);
      if (!user.isActive || !valid) {
        throw new UnauthorizedException('Invalid credentials');
      }
      // Block sign-in for a suspended or canceled company.
      if (user.tenantId) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (tenant && (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELED')) {
          const why = tenant.status === 'CANCELED' ? 'closed' : 'suspended';
          throw new UnauthorizedException(`Your company account is ${why}. Contact the platform operator.`);
        }
      }
      return this.sessionFor(user.id, 'tenant');
    }

    // 2) Control-Plane operator (separate PlatformAdmin table). Always runs a verify
    //    (dummy hash when absent) so timing doesn't leak which table an email lives in.
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: normalized } });
    const valid = await this.verifyPassword(admin?.passwordHash ?? DUMMY_HASH, password);
    if (!admin || !admin.isActive || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.sessionFor(admin.id, 'platform');
  }

  /**
   * Public self-service signup: provisions a brand-new, isolated company
   * (Tenant on a TRIAL plan + default subscription + its first SUPER_ADMIN)
   * and returns an auto-login session. No cross-tenant risk — the new admin is
   * SUPER_ADMIN of their own tenant only.
   */
  async register(dto: RegisterCompanyDto): Promise<LoginResponse> {
    const slug = dto.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) {
      throw new BadRequestException('Slug must be 2–40 chars: lowercase letters, numbers and hyphens only');
    }
    const email = dto.adminEmail.trim().toLowerCase();
    if (dto.adminPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const [slugTaken, emailTaken] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.user.findUnique({ where: { email } }),
    ]);
    if (slugTaken) throw new ConflictException('This workspace address is already taken');
    if (emailTaken) throw new ConflictException('An account with this email already exists');
    // …and free across the control-plane table too (see helper for why).
    await assertEmailNotPlatformOperator(this.prisma, email);

    const count = await this.prisma.tenant.count();
    const code = `TNT-${String(count + 1).padStart(4, '0')}`;
    const passwordHash = await argon2.hash(dto.adminPassword);

    const opt = (v?: string | null) => v?.trim() || null;
    const tenant = await this.prisma.tenant.create({
      data: {
        slug, name: dto.companyName.trim(), code, status: 'TRIAL',
        email: opt(dto.email), contactPhone: opt(dto.contactPhone), city: opt(dto.city),
        crNumber: opt(dto.crNumber), vatNumber: opt(dto.vatNumber),
      },
    });
    await this.prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planName: 'STARTER',
        status: 'TRIAL',
        maxUserCount: DEFAULT_MAX_USER_COUNT,
        maxStorageBytes: BigInt(DEFAULT_MAX_STORAGE_BYTES),
        enabledModules: DEFAULT_ENABLED_MODULES,
        seatPriceMonthly: DEFAULT_SEAT_PRICE,
        walletBalance: 0,
      },
    });

    // Give the new company its own private role set, then make the signup its SUPER_ADMIN.
    const roleIds = await provisionTenantRoles(this.prisma, tenant.id);
    const superAdminId = roleIds.get(RoleName.SUPER_ADMIN);
    if (!superAdminId) throw new BadRequestException('Failed to provision tenant roles');

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.adminName.trim(),
        passwordHash,
        tenantId: tenant.id,
        code: 'USR-0001',
        roles: { create: [{ roleId: superAdminId, tenantId: tenant.id }] },
      },
    });

    return this.sessionFor(user.id, 'tenant');
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Self-service: update the signed-in user's display name (either identity table). */
  async updateProfile(
    userId: string,
    fullName: string,
    kind: 'tenant' | 'platform' = 'tenant',
  ): Promise<{ id: string; fullName: string }> {
    const name = fullName.trim();
    if (kind === 'platform') {
      const a = await this.prisma.platformAdmin.update({ where: { id: userId }, data: { fullName: name } });
      return { id: a.id, fullName: a.fullName };
    }
    const u = await this.prisma.user.update({ where: { id: userId }, data: { fullName: name } });
    return { id: u.id, fullName: u.fullName };
  }

  /** Self-service: change own password after verifying the current one (either identity table). */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    kind: 'tenant' | 'platform' = 'tenant',
  ): Promise<{ ok: true }> {
    const currentHash =
      kind === 'platform'
        ? (await this.prisma.platformAdmin.findFirst({ where: { id: userId, isActive: true } }))?.passwordHash
        : (await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } }))?.passwordHash;
    if (!currentHash) throw new UnauthorizedException('User not found');
    if (!(await this.verifyPassword(currentHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await argon2.hash(newPassword);
    if (kind === 'platform') {
      await this.prisma.platformAdmin.update({ where: { id: userId }, data: { passwordHash } });
    } else {
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    }
    return { ok: true };
  }

  /** Build a full login session (tokens + user) for a given identity. */
  async sessionFor(userId: string, kind: 'tenant' | 'platform' = 'tenant'): Promise<LoginResponse> {
    const principal =
      kind === 'platform'
        ? await this.access.buildPlatformPrincipal(userId)
        : await this.access.buildPrincipal(userId);
    const tokens = await this.issueTokens(principal);
    return {
      ...tokens,
      user: {
        id: principal.id,
        email: principal.email,
        fullName: principal.fullName,
        isActive: true,
        roles: principal.roles,
        permissions: principal.permissions,
        scopeOrgUnitIds: principal.scopeOrgUnitIds,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    const principal =
      payload.kind === 'platform'
        ? await this.access.buildPlatformPrincipal(payload.sub)
        : await this.access.buildPrincipal(payload.sub);
    return this.issueTokens(principal);
  }

  private async issueTokens(principal: AuthenticatedUser): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: principal.id, email: principal.email, kind: principal.kind, type: 'access' },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: principal.id, kind: principal.kind, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
      },
    );
    return { accessToken, refreshToken };
  }
}
