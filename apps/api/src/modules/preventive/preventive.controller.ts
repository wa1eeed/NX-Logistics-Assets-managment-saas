import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { AssetPreventive, ComplianceView } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PreventiveService } from './preventive.service';
import { CreatePlanDto, RecordMeterDto, SetMeterTypeDto, UpdatePlanDto } from './dto/preventive.dto';

@Controller()
@AuditEntity('MaintenancePlan')
export class PreventiveController {
  constructor(private readonly preventive: PreventiveService) {}

  @Get('assets/:id/preventive')
  @RequirePermissions('assets.read')
  get(@Param('id') id: string): Promise<AssetPreventive> {
    return this.preventive.getAssetPreventive(id);
  }

  @Post('assets/:id/meter')
  @RequirePermissions('maintenance.create')
  recordMeter(@Param('id') id: string, @Body() dto: RecordMeterDto, @CurrentUser() user: AuthenticatedUser): Promise<AssetPreventive> {
    return this.preventive.recordMeter(id, dto, user.id);
  }

  @Patch('assets/:id/meter-type')
  @RequirePermissions('maintenance.create')
  setMeterType(@Param('id') id: string, @Body() dto: SetMeterTypeDto): Promise<AssetPreventive> {
    return this.preventive.setMeterType(id, dto.meterType);
  }

  @Post('assets/:id/maintenance-plans')
  @RequirePermissions('maintenance.create')
  createPlan(@Param('id') id: string, @Body() dto: CreatePlanDto): Promise<AssetPreventive> {
    return this.preventive.createPlan(id, dto);
  }

  @Patch('maintenance-plans/:planId')
  @RequirePermissions('maintenance.create')
  updatePlan(@Param('planId') planId: string, @Body() dto: UpdatePlanDto): Promise<AssetPreventive> {
    return this.preventive.updatePlan(planId, dto);
  }

  @Delete('maintenance-plans/:planId')
  @RequirePermissions('maintenance.create')
  removePlan(@Param('planId') planId: string): Promise<AssetPreventive> {
    return this.preventive.removePlan(planId);
  }

  @Post('maintenance-plans/:planId/service')
  @RequirePermissions('maintenance.create')
  logService(@Param('planId') planId: string): Promise<AssetPreventive> {
    return this.preventive.logService(planId);
  }

  @Get('compliance/overview')
  @RequirePermissions('assets.read')
  compliance(): Promise<ComplianceView> {
    return this.preventive.compliance();
  }
}
