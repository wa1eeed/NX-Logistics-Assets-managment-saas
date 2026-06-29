import { Controller, Get, Post } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('alerts')
export class NotificationsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly scheduler: AlertsSchedulerService,
  ) {}

  @Get()
  @RequirePermissions('kpis.read')
  list() {
    return this.alerts.compute();
  }

  /** Run the alerts digest now (emails if Resend configured, else logs). */
  @Post('digest/run')
  @RequirePermissions('kpis.read')
  runDigest() {
    return this.scheduler.runDigest();
  }
}
