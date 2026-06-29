import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AssetTypesService } from './asset-types.service';
import { CreateAssetTypeDto, UpdateAssetTypeDto } from './dto/asset-type.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditEntity } from '../../common/decorators/audit.decorator';

@Controller('asset-types')
@AuditEntity('AssetType')
export class AssetTypesController {
  constructor(private readonly assetTypes: AssetTypesService) {}

  @Get()
  @RequirePermissions('asset_types.read')
  list() {
    return this.assetTypes.list();
  }

  @Post()
  @RequirePermissions('asset_types.manage')
  create(@Body() dto: CreateAssetTypeDto) {
    return this.assetTypes.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('asset_types.manage')
  update(@Param('id') id: string, @Body() dto: UpdateAssetTypeDto) {
    return this.assetTypes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('asset_types.manage')
  remove(@Param('id') id: string) {
    return this.assetTypes.remove(id);
  }
}
