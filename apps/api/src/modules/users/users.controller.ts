import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, SetUserRolesDto, UpdateUserDto } from './dto/user.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';

@Controller('users')
@AuditEntity('User')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list() {
    return this.users.list();
  }

  @Get(':id')
  @RequirePermissions('users.read')
  getOne(@Param('id') id: string) {
    return this.users.getOne(id);
  }

  @Post()
  @RequirePermissions('users.create')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Put(':id/roles')
  @RequirePermissions('users.update')
  setRoles(@Param('id') id: string, @Body() dto: SetUserRolesDto) {
    return this.users.setRoles(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
