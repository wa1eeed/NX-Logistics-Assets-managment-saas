import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AssetClassesService } from './asset-classes.service';
import { ModelsService } from './models.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';
import {
  CreateAssetClassDto, CreateModelDto, ModelQueryDto, UpdateAssetClassDto, UpdateModelDto,
} from './dto/catalog.dto';

@Controller('asset-classes')
@AuditEntity('AssetClass')
export class AssetClassesController {
  constructor(private readonly classes: AssetClassesService) {}

  @Get()
  @RequirePermissions('asset_types.read')
  list() {
    return this.classes.list();
  }

  @Post()
  @RequirePermissions('asset_types.manage')
  create(@Body() dto: CreateAssetClassDto) {
    return this.classes.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('asset_types.manage')
  update(@Param('id') id: string, @Body() dto: UpdateAssetClassDto) {
    return this.classes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('asset_types.manage')
  remove(@Param('id') id: string) {
    return this.classes.remove(id);
  }
}

@Controller('models')
@AuditEntity('Model')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  @RequirePermissions('asset_types.read')
  list(@Query() query: ModelQueryDto) {
    return this.models.list(query);
  }

  @Post()
  @RequirePermissions('asset_types.manage')
  create(@Body() dto: CreateModelDto) {
    return this.models.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('asset_types.manage')
  update(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.models.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('asset_types.manage')
  remove(@Param('id') id: string) {
    return this.models.remove(id);
  }
}
