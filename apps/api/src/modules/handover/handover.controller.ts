import {
  Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { HandoverService } from './handover.service';
import { CreateInspectionDto } from './dto/handover.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller()
@AuditEntity('HandoverInspection')
export class HandoverController {
  constructor(private readonly handover: HandoverService) {}

  @Get('rentals/contracts/:id/handover')
  @RequirePermissions('rentals.read')
  view(@Param('id') id: string) {
    return this.handover.view(id);
  }

  @Post('rentals/contracts/:id/inspections')
  @RequirePermissions('rentals.return')
  create(
    @Param('id') id: string,
    @Body() dto: CreateInspectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null;
    return this.handover.createInspection(id, dto, { id: user.id, role: user.roles[0] ?? 'USER' }, ip);
  }

  @Post('inspections/:id/photos')
  @RequirePermissions('rentals.return')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  addPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.handover.addPhoto(id, file);
  }

  @Get('inspections/photo-url')
  @RequirePermissions('rentals.read')
  photoUrl(@Query('key') key: string) {
    return this.handover.photoUrl(key);
  }
}
