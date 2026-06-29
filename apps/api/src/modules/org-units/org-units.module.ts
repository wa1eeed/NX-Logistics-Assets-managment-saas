import { Module } from '@nestjs/common';
import { OrgUnitsService } from './org-units.service';
import { OrgUnitsController } from './org-units.controller';

@Module({
  controllers: [OrgUnitsController],
  providers: [OrgUnitsService],
})
export class OrgUnitsModule {}
