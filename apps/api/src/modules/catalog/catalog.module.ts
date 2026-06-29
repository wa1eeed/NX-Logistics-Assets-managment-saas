import { Module } from '@nestjs/common';
import { AssetClassesService } from './asset-classes.service';
import { ModelsService } from './models.service';
import { AssetClassesController, ModelsController } from './catalog.controller';

@Module({
  controllers: [AssetClassesController, ModelsController],
  providers: [AssetClassesService, ModelsService],
})
export class CatalogModule {}
