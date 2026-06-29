import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { InvoiceDto, InvoiceSeller } from '@nx-lam/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { InvoicesService } from './invoices.service';
import { UpdateSellerDto } from './dto/seller.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  // ---- tenant: own invoices ----

  @Get()
  @RequirePermissions('billing.read')
  listMine(): Promise<InvoiceDto[]> {
    return this.invoices.listMine();
  }

  @Get('mine/:id')
  @RequirePermissions('billing.read')
  getMine(@Param('id') id: string): Promise<InvoiceDto> {
    return this.invoices.getMine(id);
  }

  // ---- platform: seller config + all invoices ----

  @Get('seller')
  @RequirePermissions('payments.manage')
  getSeller(): Promise<InvoiceSeller> {
    return this.invoices.getSeller();
  }

  @Put('seller')
  @RequirePermissions('payments.manage')
  @AuditEntity('InvoiceSeller')
  updateSeller(@Body() dto: UpdateSellerDto): Promise<InvoiceSeller> {
    return this.invoices.updateSeller(dto);
  }

  @Get('all')
  @RequirePermissions('platform.tenants.read')
  listAll(): Promise<InvoiceDto[]> {
    return this.invoices.listAll();
  }
}
