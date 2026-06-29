import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AcquisitionService } from './acquisition.service';
import { CreateLeaseDto, CreateSupplierDto, UpdateSupplierDto } from './dto/acquisition.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequiresModule } from '../../common/decorators/requires-module.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('suppliers')
@AuditEntity('Supplier')
@RequiresModule('suppliers')
export class SuppliersController {
  constructor(private readonly acq: AcquisitionService) {}

  @Get()
  @RequirePermissions('suppliers.read')
  list() {
    return this.acq.listSuppliers();
  }

  @Post()
  @RequirePermissions('suppliers.manage')
  create(@Body() dto: CreateSupplierDto) {
    return this.acq.createSupplier(dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.acq.updateSupplier(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers.manage')
  remove(@Param('id') id: string) {
    return this.acq.removeSupplier(id);
  }
}

@Controller('external-leases')
@AuditEntity('ExternalLeaseContract')
@RequiresModule('acquisition')
export class LeasesController {
  constructor(private readonly acq: AcquisitionService) {}

  @Get()
  @RequirePermissions('acquisition.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.acq.listLeases(user);
  }

  @Post()
  @RequirePermissions('acquisition.manage')
  create(@Body() dto: CreateLeaseDto) {
    return this.acq.createLease(dto);
  }
}
