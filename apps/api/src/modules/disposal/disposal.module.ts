import { Module } from '@nestjs/common';
import { DisposalService } from './disposal.service';
import { DisposalController } from './disposal.controller';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [DisposalController],
  providers: [DisposalService],
})
export class DisposalModule {}
