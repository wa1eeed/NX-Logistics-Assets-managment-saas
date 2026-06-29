import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';

// EntitlementsService comes from the global EntitlementsModule; AuthService from AuthModule.
@Module({
  imports: [AuthModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
