import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LookupsService } from './lookups.service';
import { CreateLookupDto, UpdateLookupDto } from './dto/lookup.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';

@Controller('lookups')
@AuditEntity('Lookup')
export class LookupsController {
  constructor(private readonly lookups: LookupsService) {}

  /** Active entries for dropdowns — any authenticated user. */
  @Get()
  list(@Query('type') type?: string) {
    return this.lookups.list(type, true);
  }

  /** All entries (incl. inactive) for the admin management screen. */
  @Get('manage')
  @RequirePermissions('settings.read')
  listAll(@Query('type') type?: string) {
    return this.lookups.list(type, false);
  }

  @Post()
  @RequirePermissions('settings.manage')
  create(@Body() dto: CreateLookupDto) {
    return this.lookups.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings.manage')
  update(@Param('id') id: string, @Body() dto: UpdateLookupDto) {
    return this.lookups.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  remove(@Param('id') id: string) {
    return this.lookups.remove(id);
  }
}
