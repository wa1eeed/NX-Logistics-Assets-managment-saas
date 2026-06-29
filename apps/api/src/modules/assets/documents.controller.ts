import {
  Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/document.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Controller()
@AuditEntity('Document')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('assets/:id/documents')
  @RequirePermissions('documents.upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @Param('id') assetId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.upload(assetId, file, dto, user.id);
  }

  @Get('documents/:docId/url')
  @RequirePermissions('documents.read')
  url(@Param('docId') docId: string) {
    return this.documents.getDownloadUrl(docId);
  }

  @Delete('documents/:docId')
  @RequirePermissions('documents.upload')
  remove(@Param('docId') docId: string) {
    return this.documents.remove(docId);
  }
}
