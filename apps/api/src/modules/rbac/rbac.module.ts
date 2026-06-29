import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { PermissionsController, RolesController } from './rbac.controller';

@Module({
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsService],
})
export class RbacModule {}
