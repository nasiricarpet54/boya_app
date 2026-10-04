import { Module } from '@nestjs/common';

import { CategoryController, SalonController, SalonPanelController } from './salon.controller';
import { SalonService } from './salon.service';

@Module({
  controllers: [SalonController, CategoryController, SalonPanelController],
  providers: [SalonService],
  exports: [SalonService],
})
export class SalonModule {}
