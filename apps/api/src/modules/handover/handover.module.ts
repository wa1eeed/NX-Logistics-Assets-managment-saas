import { Module } from '@nestjs/common';
import { HandoverService } from './handover.service';
import { HandoverController } from './handover.controller';

@Module({
  controllers: [HandoverController],
  providers: [HandoverService],
})
export class HandoverModule {}
