import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServiceLine } from './entities/service-line.entity';
import { ServiceLineService } from './service-line.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceLine])],
  providers: [ServiceLineService],
  exports: [ServiceLineService],
})
export class ServiceLineModule {}
