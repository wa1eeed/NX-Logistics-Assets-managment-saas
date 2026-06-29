import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetStatusService } from './asset-status.service';
import { DocumentsService } from './documents.service';
import { AssetsController } from './assets.controller';
import { DocumentsController } from './documents.controller';

@Module({
  controllers: [AssetsController, DocumentsController],
  providers: [AssetsService, AssetStatusService, DocumentsService],
  exports: [AssetStatusService],
})
export class AssetsModule {}
