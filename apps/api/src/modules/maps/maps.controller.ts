import { Body, Controller, Get, Put } from '@nestjs/common';
import type { MapsGatewaySettings, MapsRuntime } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { MapsService } from './maps.service';
import { UpdateMapsDto } from './dto/maps.dto';

@Controller('maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  // ---- platform gateway config (Google Maps key) ----

  @Get('config')
  @RequirePermissions('maps.manage')
  getConfig(): Promise<MapsGatewaySettings> {
    return this.maps.getSettings();
  }

  @Put('config')
  @RequirePermissions('maps.manage')
  @AuditEntity('MapsProvider')
  updateConfig(@Body() dto: UpdateMapsDto): Promise<MapsGatewaySettings> {
    return this.maps.updateSettings(dto);
  }

  // ---- runtime key for any authenticated map UI (Maps JS keys are public) ----

  @Get('runtime')
  runtime(): Promise<MapsRuntime> {
    return this.maps.runtime();
  }
}
