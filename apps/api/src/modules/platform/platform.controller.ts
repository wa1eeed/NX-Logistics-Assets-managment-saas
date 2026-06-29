import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import type { LoginResponse, PlanDto, PlatformAuditItem, PlatformOverview, PlatformTenantSummary } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { PlatformService } from './platform.service';
import { ApplyPlanBodyDto, CreateTenantBodyDto, SetTenantStatusDto, UpsertPlanBodyDto } from './dto/platform.dto';
import { UpdateSubscriptionDto } from '../entitlements/dto/entitlements.dto';

/** SaaS operator panel — manages every tenant from above. */
@Controller('platform')
@AuditEntity('Tenant')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('overview')
  @RequirePermissions('platform.tenants.read')
  overview(): Promise<PlatformOverview> {
    return this.platform.overview();
  }

  @Get('audit')
  @RequirePermissions('platform.tenants.read')
  audit(): Promise<PlatformAuditItem[]> {
    return this.platform.recentActivity();
  }

  @Post('tenants')
  @RequirePermissions('platform.tenants.manage')
  create(@Body() dto: CreateTenantBodyDto): Promise<PlatformTenantSummary> {
    return this.platform.createTenant(dto);
  }

  @Patch('tenants/:id/status')
  @RequirePermissions('platform.tenants.manage')
  setStatus(@Param('id') id: string, @Body() dto: SetTenantStatusDto): Promise<PlatformTenantSummary> {
    return this.platform.setStatus(id, dto.status);
  }

  @Put('tenants/:id/subscription')
  @RequirePermissions('entitlements.manage')
  setSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto): Promise<PlatformTenantSummary> {
    return this.platform.setSubscription(id, dto);
  }

  @Post('tenants/:id/impersonate')
  @RequirePermissions('platform.impersonate')
  impersonate(@Param('id') id: string): Promise<LoginResponse> {
    return this.platform.impersonate(id);
  }

  // ---- plan catalog ----

  @Get('plans')
  @RequirePermissions('entitlements.manage')
  listPlans(): Promise<PlanDto[]> {
    return this.platform.listPlans();
  }

  @Post('plans')
  @RequirePermissions('entitlements.manage')
  createPlan(@Body() dto: UpsertPlanBodyDto): Promise<PlanDto> {
    return this.platform.createPlan(dto);
  }

  @Put('plans/:id')
  @RequirePermissions('entitlements.manage')
  updatePlan(@Param('id') id: string, @Body() dto: UpsertPlanBodyDto): Promise<PlanDto> {
    return this.platform.updatePlan(id, dto);
  }

  @Post('tenants/:id/apply-plan')
  @RequirePermissions('entitlements.manage')
  applyPlan(@Param('id') id: string, @Body() dto: ApplyPlanBodyDto): Promise<PlatformTenantSummary> {
    return this.platform.applyPlan(id, dto.planId);
  }
}
