import { Module } from '@nestjs/common';
import { PreventiveService } from './preventive.service';
import { PreventiveController } from './preventive.controller';

@Module({
  controllers: [PreventiveController],
  providers: [PreventiveService],
  exports: [PreventiveService],
})
export class PreventiveModule {}
