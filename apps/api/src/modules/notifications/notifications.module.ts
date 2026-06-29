import { Global, Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { PreventiveModule } from '../preventive/preventive.module';

@Global()
@Module({
  imports: [PreventiveModule],
  controllers: [NotificationsController],
  providers: [AlertsService, AlertsSchedulerService, EmailService],
  exports: [EmailService, AlertsService],
})
export class NotificationsModule {}
