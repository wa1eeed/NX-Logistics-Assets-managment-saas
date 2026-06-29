import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { INTEGRATION_STATUSES, type IntegrationRequestDto, type IntegrationStatus } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { IntegrationsService } from './integrations.service';

class CreateRequestDto {
  @IsOptional() @IsString() @MaxLength(40)
  type?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}

class SetStatusDto {
  @IsIn(INTEGRATION_STATUSES)
  status!: IntegrationStatus;
}

@Controller('integrations')
@AuditEntity('IntegrationRequest')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  // ---- tenant ----

  @Post()
  @RequirePermissions('billing.manage')
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthenticatedUser): Promise<IntegrationRequestDto> {
    return this.integrations.create(user, dto);
  }

  @Get()
  @RequirePermissions('billing.read')
  listMine(): Promise<IntegrationRequestDto[]> {
    return this.integrations.listMine();
  }

  @Post(':id/cancel')
  @RequirePermissions('billing.manage')
  cancel(@Param('id') id: string): Promise<IntegrationRequestDto> {
    return this.integrations.cancel(id);
  }

  // ---- platform ----

  @Get('all')
  @RequirePermissions('platform.tenants.read')
  listAll(): Promise<IntegrationRequestDto[]> {
    return this.integrations.listAll();
  }

  @Patch(':id/status')
  @RequirePermissions('platform.tenants.manage')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @CurrentUser() user: AuthenticatedUser): Promise<IntegrationRequestDto> {
    return this.integrations.setStatus(id, dto.status, user);
  }
}
