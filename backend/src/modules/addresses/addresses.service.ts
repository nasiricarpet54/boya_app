import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerAddress } from './entities/customer-address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly repository: Repository<CustomerAddress>,
  ) {}

  /**
   * لیست آدرس‌های کاربر جاری برای تننت جاری
   */
  async list(userId: string, tenantId: string): Promise<CustomerAddress[]> {
    return await this.repository.find({
      where: {
        customerId: userId,
        tenantId: tenantId,
      },
      order: {
        isDefault: 'DESC',
        createdAt: 'ASC',
      },
    });
  }

  /**
   * دریافت جزئیات یک آدرس خاص
   */
  async get(id: string, userId: string, tenantId: string): Promise<CustomerAddress> {
    const address = await this.repository.findOne({
      where: {
        id,
        customerId: userId,
        tenantId: tenantId,
      },
    });

    if (!address) {
      throw new NotFoundException(`آدرس با شناسه ${id} یافت نشد`);
    }

    return address;
  }

  /**
   * ایجاد آدرس جدید
   */
  async create(createAddressDto: CreateAddressDto, userId: string, tenantId: string): Promise<CustomerAddress> {
    const address = this.repository.create({
      ...createAddressDto,
      customerId: userId,
      tenantId: tenantId,
    });

    return await this.repository.save(address);
  }

  /**
   * بروزرسانی آدرس
   */
  async update(id: string, updateAddressDto: UpdateAddressDto, userId: string, tenantId: string): Promise<CustomerAddress> {
    const address = await this.get(id, userId, tenantId);

    Object.assign(address, updateAddressDto);
    
    return await this.repository.save(address);
  }

  /**
   * حذف آدرس
   */
  async remove(id: string, userId: string, tenantId: string): Promise<void> {
    const address = await this.get(id, userId, tenantId);
    await this.repository.remove(address);
  }

  /**
   * تنظیم آدرس به عنوان پیش‌فرض
   * 
   * درون یک ترنزاکشن، سایر آدرس‌های کاربر را از حالت پیش‌فرض خارج می‌کند
   */
  async setDefault(id: string, userId: string, tenantId: string): Promise<CustomerAddress> {
    return await this.repository.manager.transaction(async (manager) => {
      // در ابتدا همه را غیرفعال می‌کنیم
      await manager.update(CustomerAddress, { customerId: userId, tenantId: tenantId, isDefault: true }, { isDefault: false });

      // سپس آدرس مورد نظر را فعال می‌کنیم
      await manager.update(CustomerAddress, { id, customerId: userId, tenantId: tenantId, isDefault: false }, { isDefault: true });

      return await this.get(id, userId, tenantId);
    });
  }
}
