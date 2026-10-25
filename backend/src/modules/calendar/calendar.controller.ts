import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, AuthenticatedUser } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CalendarService } from "./calendar.service";

class BlockSlotDto {
  specialistId!: string;
  timeSlot!: { start: string; end: string };
  reason?: string;
}

@ApiTags("Calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/v1/calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post("block-slot")
  @ApiOperation({
    summary: "مسدود کردن اسلات برای مشتریان آفلاین یا زمان استراحت",
  })
  blockSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BlockSlotDto,
  ) {
    return this.calendarService.blockSlot(
      user,
      body.specialistId,
      body.timeSlot.start,
      body.timeSlot.end,
      body.reason,
    );
  }

  @Delete("block-slot/:id")
  @ApiOperation({ summary: "لغو مسدودیت اسلات" })
  unblockSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.unblockSlot(user, id);
  }

  @Get("my-schedule")
  @ApiOperation({
    summary: "نمایش برنامه متخصص شامل رزروهای آنلاین و زمان‌های مسدودشده",
  })
  mySchedule(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.mySchedule(user);
  }
}
