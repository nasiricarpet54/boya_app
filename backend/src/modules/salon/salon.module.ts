import { Module } from '@nestjs/common';

import { CategoryController, CustomerController, SalonController, SalonPanelController } from './salon.controller';
import { SalonService } from './salon.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  controllers: [SalonController, CategoryController, SalonPanelController, CustomerController],
  providers: [SalonService],
  exports: [SalonService],
  imports: [CacheModule],
})
export class SalonModule {}