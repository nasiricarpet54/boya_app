import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '@nestjs/config';

import { City } from './entities/city.entity';
import { Province } from './entities/province.entity';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Province, City])],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
