import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgUnitsService } from './org-units.service';
import { CreateOrgUnitDto, UpdateOrgUnitDto } from './dto/org-unit.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';

@Controller('org-units')
@AuditEntity('OrgUnit')
export class OrgUnitsController {
  constructor(private readonly orgUnits: OrgUnitsService) {}

  @Get()
  @RequirePermissions('org_units.read')
  tree() {
    return this.orgUnits.tree();
  }

  @Post()
  @RequirePermissions('org_units.manage')
  create(@Body() dto: CreateOrgUnitDto) {
    return this.orgUnits.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('org_units.manage')
  update(@Param('id') id: string, @Body() dto: UpdateOrgUnitDto) {
    return this.orgUnits.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('org_units.manage')
  remove(@Param('id') id: string) {
    return this.orgUnits.remove(id);
  }
}
