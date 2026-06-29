import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';

// EntitlementsService is provided by a @Global() module, so no imports needed.
@Module({ controllers: [PublicController] })
export class PublicModule {}
