import { Body, Controller, Get, Post, Put, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UpdatePlatformStorageDto, UpdateTenantStorageDto } from './dto/r2.dto';

/** Local fallback streaming + cloud-storage configuration (platform + per-tenant). */
@Controller('storage')
@AuditEntity('Integration')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('local')
  local(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!key || !exp || !sig || !this.storage.verify(key, Number(exp), sig)) {
      throw new BadRequestException('Invalid or expired link');
    }
    const stream = this.storage.openLocal(key);
    stream.pipe(res);
  }

  // ---- Platform shared storage account (one account for all companies) ----

  // The shared platform account is operator-level: gated by entitlements.manage
  // (a platform-reserved permission), so company admins can't see/edit it.
  @Get('platform')
  @RequirePermissions('entitlements.manage')
  async platform() {
    const [status, settings] = await Promise.all([this.storage.status(), this.storage.getPlatformStorage()]);
    return { status, settings };
  }

  @Put('platform')
  @RequirePermissions('entitlements.manage')
  updatePlatform(@Body() dto: UpdatePlatformStorageDto, @CurrentUser() _user: AuthenticatedUser) {
    return this.storage.updatePlatformStorage(dto);
  }

  @Post('platform/test')
  @RequirePermissions('entitlements.manage')
  testPlatform() {
    return this.storage.testPlatform();
  }

  /** Platform admin: recompute every tenant's usage snapshot now (nightly job, on demand). */
  @Post('reconcile')
  @RequirePermissions('entitlements.manage')
  reconcile() {
    return this.storage.reconcileAll();
  }

  // ---- This company's storage (folder, or its own dedicated bucket) ----

  @Get('tenant')
  @RequirePermissions('settings.read')
  async tenant() {
    const [status, settings] = await Promise.all([this.storage.status(), this.storage.getTenantStorage()]);
    return { status, settings };
  }

  @Put('tenant')
  @RequirePermissions('settings.manage')
  updateTenant(@Body() dto: UpdateTenantStorageDto, @CurrentUser() _user: AuthenticatedUser) {
    return this.storage.updateTenantStorage(dto);
  }

  @Post('tenant/test')
  @RequirePermissions('settings.manage')
  testTenant() {
    return this.storage.testTenant();
  }
}
