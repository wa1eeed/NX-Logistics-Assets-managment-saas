import { Module } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { ContractsController, RequestsController } from './rentals.controller';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule], // for AssetStatusService
  controllers: [RequestsController, ContractsController],
  providers: [RentalsService],
})
export class RentalsModule {}
