import { Module } from '@nestjs/common';
import { MapsModule } from '../maps/maps.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

@Module({
  imports: [MapsModule],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
