import { Module } from '@nestjs/common';
import { AcquisitionService } from './acquisition.service';
import { LeasesController, SuppliersController } from './acquisition.controller';

@Module({
  controllers: [SuppliersController, LeasesController],
  providers: [AcquisitionService],
})
export class AcquisitionModule {}
