import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SpecialistController } from './specialist.controller';
import { Specialist } from './entities/specialist.entity';
import { SpecialistService } from './specialist.service';

@Module({
  imports: [TypeOrmModule.forFeature([Specialist])],
  controllers: [SpecialistController],
  providers: [SpecialistService],
  exports: [SpecialistService],
})
export class SpecialistModule {}
