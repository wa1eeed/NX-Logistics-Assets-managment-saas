import {
  Body, Controller, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaintenanceService } from './maintenance.service';
import {
  CloseWorkOrderDto, CreateWorkOrderDto, UpdateCardDto, UploadWorkOrderDocDto, WorkOrderQueryDto,
} from './dto/maintenance.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller('maintenance')
@AuditEntity('MaintenanceWorkOrder')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @RequirePermissions('maintenance.read')
  list(@Query() query: WorkOrderQueryDto) {
    return this.maintenance.list(query);
  }

  @Get(':id')
  @RequirePermissions('maintenance.read')
  detail(@Param('id') id: string) {
    return this.maintenance.getDetail(id);
  }

  @Post()
  @RequirePermissions('maintenance.create')
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.create(dto, user.id);
  }

  @Post(':id/start')
  @RequirePermissions('maintenance.create')
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.start(id, user.id);
  }

  @Put(':id/card')
  @RequirePermissions('maintenance.card')
  card(@Param('id') id: string, @Body() dto: UpdateCardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.updateCard(id, dto, user.id);
  }

  @Post(':id/close')
  @RequirePermissions('maintenance.close')
  close(@Param('id') id: string, @Body() dto: CloseWorkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.close(id, dto, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('maintenance.create')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.maintenance.cancel(id, user.id);
  }

  @Post(':id/documents')
  @RequirePermissions('documents.upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadWorkOrderDocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.maintenance.uploadDocument(id, file, dto.docType, user.id);
  }
}
