import { CreateTicketDto } from './dto/create-ticket.dto';
import { SupportService } from './support.service';
import { SupportTicket, TicketType } from './support-ticket.entity';

/**
 * The specs stub the TypeORM repository and read back what the service saved —
 * no Postgres, no Nest container — the same way `location.service.spec.ts` stubs
 * `globalThis.fetch`. What matters here is the ownership rule: whatever the
 * caller's claims are, the persisted row carries the id from the token and only
 * the fields the DTO exposes.
 */

function ticketRepoStub() {
  const saved: SupportTicket[] = [];
  const repo = {
    create: (partial: Partial<SupportTicket>) => ({ ...partial }) as SupportTicket,
    save: async (entity: SupportTicket) => {
      saved.push(entity);
      return entity;
    },
    find: jest.fn(),
  };
  return { repo, saved };
}

describe('SupportService', () => {
  it('stamps the ticket with the caller id from the token, not the body', async () => {
    const { repo, saved } = ticketRepoStub();
    const service = new SupportService(repo as never);

    const dto = new CreateTicketDto();
    dto.type = TicketType.Complaint;
    dto.subject = 'کیفیت خدمات';
    dto.message = 'مراجعه شما حساب کمتری داشت';

    const ticket = await service.create('user-from-token', dto);

    expect(ticket.userId).toBe('user-from-token');
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe('user-from-token');
  });

  it('persists only the fields the DTO exposes', async () => {
    const { repo, saved } = ticketRepoStub();
    const service = new SupportService(repo as never);

    const dto = new CreateTicketDto();
    dto.type = TicketType.Suggestion;
    dto.subject = 'اضافه کردن خدمات جدید';
    dto.message = 'ایده برای خدمات سیار';
    dto.bookingId = 'booking-1';
    dto.salonId = 'salon-1';

    await service.create('user-1', dto);

    // Status/priority are never taken from the request.
    expect(saved[0]).toMatchObject({
      type: TicketType.Suggestion,
      subject: 'اضافه کردن خدمات جدید',
      message: 'ایده برای خدمات سیار',
      bookingId: 'booking-1',
      salonId: 'salon-1',
    });
    expect(saved[0]).not.toHaveProperty('status');
    expect(saved[0]).not.toHaveProperty('priority');
  });

  it('stores absent context as null rather than leaving it unset', async () => {
    const { repo, saved } = ticketRepoStub();
    const service = new SupportService(repo as never);

    const dto = new CreateTicketDto();
    dto.type = TicketType.Question;
    dto.subject = 'نحوه استفاده از اعتبار';
    dto.message = 'چطور می‌توانم اعتبار خود را شارژ کنم؟';

    await service.create('user-1', dto);

    expect(saved[0].bookingId).toBeNull();
    expect(saved[0].salonId).toBeNull();
  });

  it('lists only the caller tickets, newest first', async () => {
    const { repo } = ticketRepoStub();
    repo.find.mockResolvedValue([]);
    const service = new SupportService(repo as never);

    await service.listMine('user-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
  });
});
