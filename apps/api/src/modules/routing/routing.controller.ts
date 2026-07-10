import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { OptimizeResult, RouteResult } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RoutingService } from './routing.service';
import { DirectionsDto, OptimizeDto } from './dto/routing.dto';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}

  @Post('directions')
  @RequirePermissions('assets.read')
  @HttpCode(200)
  directions(@Body() dto: DirectionsDto): Promise<RouteResult> {
    return this.routing.directions(dto);
  }

  @Post('optimize')
  @RequirePermissions('assets.read')
  @HttpCode(200)
  optimize(@Body() dto: OptimizeDto): Promise<OptimizeResult> {
    return this.routing.optimize(dto);
  }
}
