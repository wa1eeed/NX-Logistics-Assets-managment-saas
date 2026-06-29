import { Controller, Get } from '@nestjs/common';
import { KpisService } from './kpis.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpis: KpisService) {}

  @Get('fleet')
  @RequirePermissions('kpis.read')
  fleet() {
    return this.kpis.fleet();
  }

  @Get('maintenance')
  @RequirePermissions('maintenance.read')
  maintenance() {
    return this.kpis.maintenance();
  }

  @Get('dispatch')
  @RequirePermissions('rentals.read')
  dispatch() {
    return this.kpis.dispatch();
  }
}
