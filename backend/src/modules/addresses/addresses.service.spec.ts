import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult, DeleteResult } from 'typeorm';

import { AddressesService } from './addresses.service';
import { CustomerAddress } from './entities/customer-address.entity';

function makeRepo(): Repository<CustomerAddress> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as Repository<CustomerAddress>;
}

function makeDataSource(): { transaction: jest.Mock } {
  return { transaction: jest.fn(((callback: (qr: unknown) => unknown) => Promise.resolve({})) as any) };
}

describe('AddressesService', () => {
  let service: AddressesService;
  let repo: Repository<CustomerAddress>;
  let dataSource: ReturnType<typeof makeDataSource>;

  const sample = (overrides: Partial<CustomerAddress> = {}): CustomerAddress =>
    ({
      id: 'addr-1',
      userId: 'user-1',
      title: 'home',
      address: 'خیابان نمونه، پلاک ۱',
      latitude: 35.7,
      longitude: 51.4,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as unknown as CustomerAddress);

  beforeEach(async () => {
    repo = makeRepo();
    dataSource = makeDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        { provide: getRepositoryToken(CustomerAddress), useValue: repo },
        { provide: 'DataSource', useValue: dataSource },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
  });

  it('لیست آدرس‌ها را با order صحیح برمی‌گرداند', async () => {
    repo.find.mockResolvedValue([sample({ id: 'b', isDefault: true }), sample({ id: 'a', title: 'other' })]);
    const list = await service.list('user-1');
    expect(list).toHaveLength(2);
    expect(repo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { isDefault: 'DESC', title: 'ASC', createdAt: 'DESC' },
    });
  });

  it('سر Όفری آدرس یافت نشد به استثنای دستور هم می‌رساند', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.get('user-1', 'addr-9')).rejects.toThrow('آدرس یافت نشد');
  });

  it('ایجاد آدرس پیش‌فرض، قبلی را خاموش می‌کند', async () => {
    repo.create.mockReturnValue(sample({ id: 'new' }));
    repo.save.mockResolvedValue(sample({ id: 'new', isDefault: true }));
    repo.update.mockResolvedValue({ affected: 1 } as UpdateResult);

    const created = await service.create('user-1', {
      title: 'home',
      address: 'خیابان عدد ۱',
      latitude: 35.7,
      longitude: 51.4,
      isDefault: true,
    });

    expect(created.isDefault).toBe(true);
    expect(repo.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { isDefault: false },
    );
  });

  it('ایجاد آدرس عادی، حالت پیش‌فرض را تغییر نمی‌دهد', async () => {
    repo.create.mockReturnValue(sample({ id: 'new' }));
    repo.save.mockResolvedValue(sample({ id: 'new', isDefault: false }));
    repo.update.mockResolvedValue({ affected: 1 } as UpdateResult);

    const created = await service.create('user-1', {
      title: 'other',
      address: 'خیابان شماره ۲',
      latitude: 35.7,
      longitude: 51.4,
    });

    expect(created.isDefault).toBe(false);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('ویرایش صرفاً نام و متن آدرس را تغییر می‌دهد', async () => {
    repo.findOne.mockResolvedValue(sample({ id: 'addr-1', title: 'home', address: 'A' }));
    repo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    repo.findOne.mockResolvedValueOnce(sample({ id: 'addr-1', title: 'work', address: 'B' }));

    const updated = await service.update('user-1', 'addr-1', { title: 'work', address: 'B' });

    expect(updated.title).toBe('work');
    expect(repo.update).toHaveBeenCalledWith({ id: 'addr-1', userId: 'user-1' }, { title: 'work', address: 'B' });
  });

  it('تنظیم پیش‌فرض بهتر از درخواست PATCH است', async () => {
    repo.findOne.mockResolvedValue(sample({ id: 'addr-1', isDefault: false }));
    repo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    repo.findOne.mockResolvedValueOnce(sample({ id: 'addr-1', isDefault: true }));

    const set = await service.setDefault('user-1', 'addr-1');

    expect(set.isDefault).toBe(true);
    expect(repo.update).toHaveBeenCalledTimes(2);
    expect(repo.update).toHaveBeenNthCalledWith(1, { userId: 'user-1' }, { isDefault: false });
    expect(repo.update).toHaveBeenNthCalledWith(2, { id: 'addr-1', userId: 'user-1' }, { isDefault: true });
  });

  it('حذف آدرس تاثیر رزروهای وجودی را ندارند (حذف رد می‌شود فقط وقتی آدرس وجود نداشته باشد)', async () => {
    repo.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

    await expect(service.remove('user-1', 'addr-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith({ id: 'addr-1', userId: 'user-1' });
  });

  it('کاراکترهای نامعتبر در title و address به خطا می‌انجامد', async () => {
    await expect(
      service.create('user-1', {
        title: 'house',
        address: 'x',
        latitude: 35.7,
        longitude: 51.4,
      }),
    ).rejects.toThrow();
  });
});
