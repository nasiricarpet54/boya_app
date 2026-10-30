import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { SupportTicket } from './support-ticket.entity';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket])],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, AdminSupportService],
  exports: [SupportService],
})
export class SupportModule {}