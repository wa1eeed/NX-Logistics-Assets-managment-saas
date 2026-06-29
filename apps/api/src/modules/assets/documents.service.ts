import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentEntityType, type AssetDocumentItem } from '@nx-lam/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { processUpload } from '../../utils/file-processing';
import { UploadDocumentDto } from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    assetId: string,
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    userId: string,
  ): Promise<AssetDocumentItem> {
    if (!file) throw new BadRequestException('File is required');
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');

    const processed = await processUpload(file);
    const key = this.storage.buildKey(`assets/${assetId}`, processed.fileName);
    await this.storage.putObject(key, processed.buffer, processed.contentType);

    const doc = await this.prisma.document.create({
      data: {
        entityType: DocumentEntityType.ASSET,
        assetId,
        docType: dto.docType.trim(),
        fileKey: key,
        fileName: processed.fileName,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        uploadedBy: userId,
      },
    });

    return this.toItem(doc);
  }

  async getDownloadUrl(docId: string): Promise<{ url: string; fileName: string | null }> {
    const doc = await this.prisma.document.findFirst({ where: { id: docId, deletedAt: null } });
    if (!doc) throw new NotFoundException('Document not found');
    const url = await this.storage.getSignedUrl(doc.fileKey);
    return { url, fileName: doc.fileName };
  }

  async remove(docId: string): Promise<{ id: string }> {
    const doc = await this.prisma.document.findFirst({ where: { id: docId, deletedAt: null } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.document.update({ where: { id: docId }, data: { deletedAt: new Date() } });
    await this.storage.deleteObject(doc.fileKey).catch(() => undefined);
    return { id: docId };
  }

  private toItem(d: {
    id: string; docType: string; fileName: string | null; expiryDate: Date | null; createdAt: Date; uploadedBy: string | null;
  }): AssetDocumentItem {
    return {
      id: d.id,
      docType: d.docType,
      fileName: d.fileName,
      expiryDate: d.expiryDate?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      uploadedBy: d.uploadedBy,
    };
  }
}
