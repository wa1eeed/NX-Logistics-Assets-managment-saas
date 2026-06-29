import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AssetsService } from './assets.service';
import { AssetStatusService } from './asset-status.service';
import {
  AssetQueryDto, ChangeStatusDto, CommissionDto, CreateAssetDto, UpdateAssetDto, UpdateVehicleDto,
} from './dto/asset.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('assets')
@AuditEntity('Asset')
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly status: AssetStatusService,
  ) {}

  @Get()
  @RequirePermissions('assets.read')
  list(@Query() query: AssetQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.list(query, user);
  }

  @Get(':id')
  @RequirePermissions('assets.read')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.getProfile(id, user);
  }

  @Get(':id/operations')
  @RequirePermissions('assets.read')
  operations(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.operations(id, user);
  }

  @Get(':id/timeline')
  @RequirePermissions('assets.read')
  timeline(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.timeline(id, user);
  }

  @Post()
  @RequirePermissions('assets.create')
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('assets.update')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.update(id, dto, user);
  }

  @Put(':id/vehicle')
  @RequirePermissions('assets.update')
  upsertVehicle(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.upsertVehicle(id, dto, user);
  }

  @Post(':id/commission')
  @RequirePermissions('assets.update')
  commission(@Param('id') id: string, @Body() dto: CommissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.commission(id, dto, user);
  }

  @Post(':id/status')
  @RequirePermissions('assets.status')
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.status.changeStatus(id, dto.status, user.id, {
      forSaleFlag: dto.forSaleFlag,
      reason: dto.reason,
      ip: (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null,
    });
    return this.assets.getProfile(id, user);
  }

  @Delete(':id')
  @RequirePermissions('assets.delete')
  remove(@Param('id') id: string) {
    return this.assets.remove(id);
  }
}
