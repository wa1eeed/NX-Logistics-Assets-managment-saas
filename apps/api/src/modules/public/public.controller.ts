import { Controller, Get } from '@nestjs/common';
import type { PlanDto } from '@nx-lam/shared';
import { Public } from '../../common/decorators/public.decorator';
import { EntitlementsService } from '../entitlements/entitlements.service';

/** Unauthenticated endpoints for the public marketing site (landing page). */
@Controller('public')
export class PublicController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /** Active subscription plans for the public pricing section. */
  @Public()
  @Get('plans')
  async plans(): Promise<PlanDto[]> {
    const plans = await this.entitlements.listPlans();
    return plans.filter((p) => p.isActive);
  }
}
