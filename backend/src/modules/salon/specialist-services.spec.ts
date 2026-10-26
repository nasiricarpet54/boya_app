import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { SalonService } from './salon.service';
import { SetSpecialistServicesDto } from './dto/specialist-services.dto';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { CacheService } from '../cache/cache.service';

const TENANT = '22222222-2222-2222-2222-222222222222';
const SPECIALIST = '33333333-3333-3333-3333-333333333333';
const OTHER_SPECIALIST = '44444444-4444-4444-4444-444444444444';
const OWNER_USER: AuthenticatedUser = {
  userId: '11111111-1111-1111-1111-111111111111',
  phoneNumber: '09120000000',
  role: 'salon_owner',
  tenantId: TENANT,
};
const SPECIALIST_USER: AuthenticatedUser = {
  userId: '55555555-5555-5555-5555-555555555555',
  phoneNumber: '09120000001',
  role: 'specialist',
  tenantId: TENANT,
};

/**
 * A `DataSource` that answers every `query` from a queue. Two queues because
 * the panel methods run inside `transaction(cb)` (manager-scoped queries) while
 * the public read queries the DataSource directly.
 */
class FakeDataSource {
  /** Replies the manager sees, in call order (set_config included). */
  managerReplies: unknown[][] = [];
  /** Replies the direct `dataSource.query` calls see, in call order. */
  replies: unknown[][] = [];
  query = jest.fn(async () => this.replies.shift() ?? []);
  transaction = jest.fn(async (work: (manager: FakeManager) => Promise<unknown>) => {
    const manager = new FakeManager(this);
    return work(manager);
  });
}

class FakeManager {
  constructor(private readonly ds: FakeDataSource) {}
  query = jest.fn(async () => this.ds.managerReplies.shift() ?? []);
}

const serviceRow = {
  id: '66666666-6666-6666-6666-666666666666',
  specialist_id: SPECIALIST,
  service_id: '77777777-7777-7777-7777-777777777777',
  name: 'کوتاهی مو',
  description: null,
  price: '120000',
  duration_minutes: 30,
  is_active: true,
  is_mobile_available: false,
};


describe('SalonService specialist services', () => {
  let dataSource: FakeDataSource;
  let service: SalonService;

  beforeEach(() => {
    dataSource = new FakeDataSource();
    jest.clearAllMocks();
    dataSource.query.mockImplementation(async () => dataSource.replies.shift() ?? []);
    service = new SalonService(dataSource as never, {} as EventEmitter2, {} as CacheService);
  });

  describe('panel read (GET /salon/me/specialists/:id/services)', () => {
    it('returns the services assigned to a specialist of the salon', async () => {
      dataSource.managerReplies = [[], [{ id: SPECIALIST }], [serviceRow]];

      const items = await service.listPanelSpecialistServices(OWNER_USER, SPECIALIST);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        serviceId: serviceRow.service_id,
        name: serviceRow.name,
        price: 120000,
        durationMinutes: 30,
        isActive: true,
      });
    });

    it('answers 403 when a specialist asks for another specialist', async () => {
      // The panel lists every specialist id of the salon, so reading another
      // row by id is a real cross-account read; the charter makes it a 403.
      dataSource.managerReplies = [[], []];

      await expect(
        service.listPanelSpecialistServices(SPECIALIST_USER, OTHER_SPECIALIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('answers 404 for an id the salon does not have', async () => {
      dataSource.managerReplies = [[], []];

      await expect(
        service.listPanelSpecialistServices(OWNER_USER, OTHER_SPECIALIST),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('panel write (PUT /salon/me/specialists/:id/services)', () => {
    const dto: SetSpecialistServicesDto = {
      services: [{ serviceId: serviceRow.service_id, isActive: true }],
    };

    it('upserts the assignment and returns the resulting list', async () => {
      dataSource.managerReplies = [
        [], // set_config
        [{ id: SPECIALIST }], // specialist exists
        [{ id: serviceRow.service_id }], // the service belongs to this tenant
        [], // DELETE of unlisted rows
        [], // INSERT … ON CONFLICT upsert
        [serviceRow], // final SELECT of the assignment list
      ];

      const items = await service.setPanelSpecialistServices(OWNER_USER, SPECIALIST, dto);

      expect(items).toHaveLength(1);
      expect(items[0].serviceId).toBe(serviceRow.service_id);
    });

    it('answers 403 when a specialist tries to define their own services', async () => {
      await expect(
        service.setPanelSpecialistServices(SPECIALIST_USER, SPECIALIST, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('answers 400 when a service of another salon is sent', async () => {
      dataSource.managerReplies = [
        [], // set_config
        [{ id: SPECIALIST }],
        [], // none of the sent ids resolve under this tenant
      ];

      await expect(
        service.setPanelSpecialistServices(OWNER_USER, SPECIALIST, {
          services: [{ serviceId: '99999999-9999-9999-9999-999999999999' }],
        }),
      ).rejects.toThrow(/متعلق به این سالن نیست/);
    });

    it('answers 404 for a specialist the salon does not have', async () => {
      dataSource.managerReplies = [[], []];

      await expect(
        service.setPanelSpecialistServices(OWNER_USER, OTHER_SPECIALIST, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
