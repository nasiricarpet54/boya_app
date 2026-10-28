import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DataSource } from 'typeorm';
import { setUserContext } from '../../database/tenant-context';
import { CustomerAddress } from './entities/customer-address.entity';

/**
 * Saved addresses the customer selects from when booking on-site (decision 6:
 * no manual address entry; only choosing an address or picking from the map).
 *
 * Read: `WHERE user_id = ?` inside a transaction that also sets the session
 * GUC `app.current_user_id` (RLS key, FORCE). Write: every statement names
 * `user_id` explicitly (second net for the runtime role `beauty_app` that
 * bypasses RLS), and `beauty` (migration owner) is covered by the explicit
 * grants in the migration. Removing/updating never touches `bookings` — the
 * booking row already holds `customer_address`/`customer_latitude`/
 * `customer_longitude`, so a deleted address only affects future bookings.
 */
@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly repo: Repository<CustomerAddress>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Every read is: (1) the session context, (2) the explicit `user_id` filter.
   */
  async list(userId: string): Promise<CustomerAddress[]> {
    return this.dataSource.transaction(async (qr) => {
      await setUserContext(qr, userId);
      return qr.find({
        where: { userId },
        order: { isDefault: 'DESC', title: 'ASC', createdAt: 'DESC' },
      });
    });
  }

  async get(userId: string, id: string): Promise<CustomerAddress> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('آدرس یافت نشد');
    return row;
  }

  async create(
    userId: string,
    dto: { title: string; address: string; latitude: number; longitude: number; isDefault?: boolean },
  ): Promise<CustomerAddress> {
    return this.dataSource.transaction(async (qr) => {
      await setUserContext(qr, userId);

      // Default flips the whole set: the previous default turns off first
      // (decision 5), enforced by the unique partial index.
      if (dto.isDefault) {
        await qr.update(CustomerAddress, { userId }, { isDefault: false });
      }

      const created = qr.create({
        userId,
        title: dto.title,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isDefault: dto.isDefault ?? false,
      });
      return qr.save(created);
    });
  }

  async update(
    userId: string,
    id: string,
    patch: Partial<{ title: string; address: string }>,
  ): Promise<CustomerAddress> {
    const existing = await this.get(userId, id);

    if (patch.title !== undefined || patch.address !== undefined) {
      await this.repo.update({ id, userId }, patch);
      return this.get(userId, id);
    }

    // "set as default" is handled by the separate route; PATCH only edits text.
    return existing;
  }

  async setDefault(userId: string, id: string): Promise<CustomerAddress> {
    const existing = await this.get(userId, id);

    // Turn every other default off first (decision 5), then flip this one on.
    await this.repo.update({ userId }, { isDefault: false });
    await this.repo.update({ id, userId }, { isDefault: true });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.delete({ id, userId });
    if (deleted.affected === 0) throw new NotFoundException('آدرس یافت نشد');
  }
}
