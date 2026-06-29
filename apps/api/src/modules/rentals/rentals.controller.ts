import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import {
  ApproveRequestDto, AssignDispatchDto, ContractQueryDto, CreateRequestDto, ExtendContractDto, IssueContractDto, RequestQueryDto,
} from './dto/rentals.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('rentals/requests')
@AuditEntity('EquipmentRequest')
export class RequestsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get()
  @RequirePermissions('rentals.read')
  list(@Query() query: RequestQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.listRequests(query, user);
  }

  @Get('lookups/org-units')
  @RequirePermissions('rentals.read')
  orgUnits(@CurrentUser() user: AuthenticatedUser) {
    return this.rentals.requestableOrgUnits(user);
  }

  @Post()
  @RequirePermissions('rentals.request')
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.createRequest(dto, user);
  }

  @Post(':id/approve')
  @RequirePermissions('rentals.approve')
  approve(@Param('id') id: string, @Body() dto: ApproveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.approve(id, dto, user);
  }

  @Post(':id/reject')
  @RequirePermissions('rentals.approve')
  reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.reject(id, user);
  }

  @Post(':id/cancel')
  @RequirePermissions('rentals.request')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.cancel(id, user);
  }

  @Post(':id/contract')
  @RequirePermissions('rentals.contract')
  issue(@Param('id') id: string, @Body() dto: IssueContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.issueContract(id, dto, user);
  }

  /** Transport one-step: assign the asset and dispatch it to the project. */
  @Post(':id/assign')
  @RequirePermissions('rentals.contract')
  assign(@Param('id') id: string, @Body() dto: AssignDispatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.assignAndDispatch(id, dto, user);
  }
}

@Controller('rentals/contracts')
@AuditEntity('RentalContract')
export class ContractsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get()
  @RequirePermissions('rentals.read')
  list(@Query() query: ContractQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.listContracts(query, user);
  }

  @Get('custody')
  @RequirePermissions('rentals.read')
  custody(@CurrentUser() user: AuthenticatedUser) {
    return this.rentals.custody(user);
  }

  @Post(':id/extend')
  @RequirePermissions('rentals.extend')
  extend(@Param('id') id: string, @Body() dto: ExtendContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.extend(id, dto, user);
  }

  @Post(':id/return')
  @RequirePermissions('rentals.return')
  returnContract(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rentals.returnContract(id, user);
  }
}
