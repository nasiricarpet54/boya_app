import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CustomerAddress } from './entities/customer-address.entity';

@ApiTags('customer-addresses')
@Controller('customer/addresses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'لیست آدرسهای مشتری' })
  @ApiResponse({ status: 200, type: [CustomerAddress] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<CustomerAddress[]> {
    return this.addresses.list(user.userId, user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات یک آدرس' })
  @ApiResponse({ status: 200, type: CustomerAddress })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerAddress> {
    return this.addresses.get(id, user.userId, user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'ایجاد آدرس جدید' })
  @ApiResponse({ status: 201, type: CustomerAddress })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAddressDto,
  ): Promise<CustomerAddress> {
    return this.addresses.create(body, user.userId, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش آدرس' })
  @ApiResponse({ status: 200, type: CustomerAddress })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAddressDto,
  ): Promise<CustomerAddress> {
    return this.addresses.update(id, body, user.userId, user.tenantId);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'تنظیم آدرس پیشفرض' })
  @ApiResponse({ status: 200, type: CustomerAddress })
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerAddress> {
    return this.addresses.setDefault(id, user.userId, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف آدرس' })
  @ApiResponse({ status: 200 })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.addresses.remove(id, user.userId, user.tenantId);
  }
}