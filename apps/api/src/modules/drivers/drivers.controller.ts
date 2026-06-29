import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { DriversService } from './drivers.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';

export class CreateDriverDto {
  @IsString() @MinLength(2)
  fullName!: string;

  @IsOptional() @IsString()
  iqamaNumber?: string;

  @IsOptional() @IsString()
  licenseExpiry?: string;

  @IsOptional() @IsString()
  iqamaExpiry?: string;
}

export class UpdateDriverDto {
  @IsOptional() @IsString() @MinLength(2)
  fullName?: string;

  @IsOptional() @IsString()
  iqamaNumber?: string;

  @IsOptional() @IsString()
  licenseExpiry?: string | null;

  @IsOptional() @IsString()
  iqamaExpiry?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class AssignVehicleDto {
  // assetId of the vehicle to assign; null/empty unassigns the driver.
  @IsOptional() @IsString()
  assetId?: string | null;
}

@Controller('drivers')
@AuditEntity('Driver')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @RequirePermissions('drivers.read')
  list() {
    return this.drivers.list();
  }

  @Post()
  @RequirePermissions('drivers.manage')
  create(@Body() dto: CreateDriverDto) {
    return this.drivers.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('drivers.manage')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.drivers.update(id, dto);
  }

  @Patch(':id/assign')
  @RequirePermissions('drivers.manage')
  assign(@Param('id') id: string, @Body() dto: AssignVehicleDto) {
    return this.drivers.assignVehicle(id, dto.assetId ?? null);
  }

  @Get('assignable-vehicles')
  @RequirePermissions('drivers.read')
  assignable() {
    return this.drivers.assignableVehicles();
  }

  @Delete(':id')
  @RequirePermissions('drivers.manage')
  remove(@Param('id') id: string) {
    return this.drivers.remove(id);
  }
}
