import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import type { GeofenceDto, TrackedAssetDto, TrackingConsole, TrackingDeviceDto, TrackingStatusDto } from '@nx-lam/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { TrackingService } from './tracking.service';
import { CreateGeofenceBodyDto, IngestBodyDto, RegisterDeviceBodyDto } from './dto/tracking.dto';

@Controller('tracking')
@AuditEntity('Tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('status')
  @RequirePermissions('assets.read')
  status(): Promise<TrackingStatusDto> {
    return this.tracking.status();
  }

  @Get('assets')
  @RequirePermissions('assets.read')
  trackedAssets(): Promise<TrackedAssetDto[]> {
    return this.tracking.trackedAssets();
  }

  /** Live ops console: drivers (available/offline) + tasks (pending/active) + map coords. */
  @Get('console')
  @RequirePermissions('assets.read')
  console(): Promise<TrackingConsole> {
    return this.tracking.consoleData();
  }

  @Get('devices')
  @RequirePermissions('assets.read')
  devices(): Promise<TrackingDeviceDto[]> {
    return this.tracking.listDevices();
  }

  @Post('devices')
  @RequirePermissions('assets.update')
  registerDevice(@Body() dto: RegisterDeviceBodyDto) {
    return this.tracking.registerDevice(dto);
  }

  @Post('assets/:id/enable')
  @RequirePermissions('assets.update')
  @HttpCode(200)
  enable(@Param('id') id: string) {
    return this.tracking.enableAsset(id);
  }

  @Post('assets/:id/disable')
  @RequirePermissions('assets.update')
  @HttpCode(200)
  disable(@Param('id') id: string) {
    return this.tracking.disableAsset(id);
  }

  @Get('geofences')
  @RequirePermissions('assets.read')
  geofences(): Promise<GeofenceDto[]> {
    return this.tracking.listGeofences();
  }

  @Post('geofences')
  @RequirePermissions('assets.update')
  createGeofence(@Body() dto: CreateGeofenceBodyDto): Promise<GeofenceDto> {
    return this.tracking.createGeofence(dto);
  }

  @Delete('geofences/:id')
  @RequirePermissions('assets.update')
  deleteGeofence(@Param('id') id: string) {
    return this.tracking.deleteGeofence(id);
  }

  /** Public hardware ingest — authenticated per-device by HMAC (x-signature header). */
  @Public()
  @Post('ingest')
  @HttpCode(200)
  ingest(@Body() body: IngestBodyDto, @Headers('x-signature') signature: string) {
    return this.tracking.ingest(body, signature ?? '');
  }
}
