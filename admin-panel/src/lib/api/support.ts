import api from './client';

export type TicketType = 'question' | 'complaint' | 'suggestion' | 'other';
export type TicketStatus = 'open' | 'answered' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';

export interface SupportTicket {
  id: string;
  userId: string;
  type: TicketType;
  subject: string;
  message: string;
  bookingId: string | null;
  salonId: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  adminResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketListPage {
  data: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ListTicketsQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  salonId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  adminResponse?: string;
}

export const supportApi = {
  listTickets(query: ListTicketsQuery = {}): Promise<SupportTicketListPage> {
    return api
      .get<SupportTicketListPage>('/admin/support/tickets', {
        params: {
          status: query.status || undefined,
          priority: query.priority || undefined,
          type: query.type || undefined,
          salonId: query.salonId || undefined,
          search: query.search || undefined,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
        },
      })
      .then((r) => r.data);
  },

  updateTicket(id: string, payload: UpdateTicketPayload): Promise<SupportTicket> {
    return api
      .patch<SupportTicket>(`/admin/support/tickets/${id}`, payload)
      .then((r) => r.data);
  },
};