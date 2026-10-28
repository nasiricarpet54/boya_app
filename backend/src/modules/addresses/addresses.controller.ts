import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AddressesService } from './addresses.service';

/**
 * Saved addresses the customer picks from when booking on-site
 * (`GET /customer/addresses`).
 *
 * `CustomerGuard` (owner-only) is the first net; the service scopes every
 * query by `user_id` (second net). Routes are read-only from the customer's
 * perspective plus the three data mutations — nothing here is a admin action.
 */
@ApiTags('customer/addresses')
@Controller('customer/addresses')
@UseGuards(RolesGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'لیست آدرس‌های مشتری (مصرف شده در فرم رزرو)' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<CustomerAddress[]> {
    return this.addresses.list(user.userId);
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'جزئیات یک آدرس' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerAddress> {
    return this.addresses.get(user.userId, id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'ذخیره آدرس جدید' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { title: string; address: string; latitude: number; longitude: number; isDefault?: boolean },
  ): Promise<CustomerAddress> {
    return this.addresses.create(user.userId, body);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'ویرایش متن آدرس (برچسب/متن)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { title?: string; address?: string },
  ): Promise<CustomerAddress> {
    return this.addresses.update(user.userId, id, body);
  }

  @Patch(':id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'انتخاب آدرس پیش‌فرض (دیگر پیش‌فرض‌های دیگر خاموش می‌شوند)' })
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerAddress> {
    return this.addresses.setDefault(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'حذف آدرس (رزروهای ساخته‌شده از آن آدرس به‌احتمال بدونِ آدرس تبدیل نمی‌شوند؛ booking_row حفظ می‌شود)' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.addresses.remove(user.userId, id);
  }
}
