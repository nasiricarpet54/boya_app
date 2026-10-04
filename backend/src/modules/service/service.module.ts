import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServiceLineModule } from '../service-line/service-line.module';
import { ServiceController } from './service.controller';
import { Service } from './entities/service.entity';
import { ServiceCatalogService } from './service.service';

@Module({
  imports: [TypeOrmModule.forFeature([Service]), ServiceLineModule],
  controllers: [ServiceController],
  providers: [ServiceCatalogService],
  exports: [ServiceCatalogService],
})
export class ServiceModule {}
