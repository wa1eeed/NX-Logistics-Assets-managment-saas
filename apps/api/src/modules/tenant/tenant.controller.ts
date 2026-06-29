import { Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { TenantBranding, TenantMe, TenantProfile } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { TenantService } from './tenant.service';
import { UpdateBrandingDto, UpdateProfileDto } from './dto/branding.dto';

@Controller('tenant')
@AuditEntity('Tenant')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  /** Any signed-in tenant user — used to theme the app shell. */
  @Get('me')
  me(): Promise<TenantMe> {
    return this.tenant.me();
  }

  @Put('branding')
  @RequirePermissions('settings.manage')
  updateBranding(@Body() dto: UpdateBrandingDto): Promise<TenantBranding> {
    return this.tenant.updateBranding(dto);
  }

  @Put('profile')
  @RequirePermissions('settings.manage')
  updateProfile(@Body() dto: UpdateProfileDto): Promise<TenantProfile> {
    return this.tenant.updateProfile(dto);
  }

  @Post('logo')
  @RequirePermissions('settings.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  setLogo(@UploadedFile() file: Express.Multer.File): Promise<TenantBranding> {
    return this.tenant.setLogo(file);
  }
}
