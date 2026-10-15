import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingLedger } from './accounting-ledger.entity';
import { AccountingService } from './accounting.service';
import { SpecialistModule } from '../specialist/specialist.module';

@Module({
  imports: [TypeOrmModule.forFeature([AccountingLedger]), SpecialistModule],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
