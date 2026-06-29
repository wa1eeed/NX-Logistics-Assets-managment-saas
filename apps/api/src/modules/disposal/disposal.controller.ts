import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DisposalService } from './disposal.service';
import { CompleteSaleDto, ProposeSaleDto, SaleQueryDto } from './dto/disposal.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequiresModule } from '../../common/decorators/requires-module.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('sale-orders')
@AuditEntity('SaleOrder')
@RequiresModule('disposal')
export class DisposalController {
  constructor(private readonly disposal: DisposalService) {}

  @Get()
  @RequirePermissions('sale.read')
  list(@Query() q: SaleQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.disposal.list(q.status, user);
  }

  @Post()
  @RequirePermissions('sale.create')
  propose(@Body() dto: ProposeSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.disposal.propose(dto, user);
  }

  @Post(':id/approve')
  @RequirePermissions('sale.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.disposal.approve(id, user);
  }

  @Post(':id/complete')
  @RequirePermissions('sale.complete')
  complete(@Param('id') id: string, @Body() dto: CompleteSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.disposal.complete(id, dto, user);
  }

  @Post(':id/withdraw')
  @RequirePermissions('sale.approve')
  withdraw(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.disposal.withdraw(id, user);
  }
}
