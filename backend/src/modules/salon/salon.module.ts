import { Module } from '@nestjs/common';

import { CategoryController, SalonController, SalonPanelController } from './salon.controller';
import { SalonService } from './salon.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  controllers: [SalonController, CategoryController, SalonPanelController],
  providers: [SalonService],
  exports: [SalonService],
  imports: [CacheModule],
})
export class SalonModule {}
