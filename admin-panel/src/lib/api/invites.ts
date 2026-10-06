import api from './client';

/** Roles an invite can grant. `customer`/`admin` are absent by design (ADR-010). */
export type InviteRole = 'salon_owner' | 'line_manager' | 'specialist';

export const INVITE_ROLES: InviteRole[] = ['salon_owner', 'line_manager', 'specialist'];

/**
 * What `POST /auth/invite` answers with. `token` is returned exactly once —
 * the database only holds its SHA-256 hash, so a lost token cannot be
 * recovered, only revoked and re-issued.
 */
export interface IssuedInvite {
  id: string;
  token: string;
  role: InviteRole;
  tenantId: string;
  expiresAt: string;
}

/** One row of `GET /auth/invite/list` — pending invites only. */
export interface PendingInvite {
  id: string;
  role: InviteRole;
  phone: string | null;
  email: string | null;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInviteBody {
  role: InviteRole;
  phone?: string;
  email?: string;
  /**
   * Target salon. The panel signs in as `admin`, whose JWT carries no tenant,
   * so every call must name one; the backend rejects an admin call without it.
   */
  tenantId: string;
}

export const invitesApi = {
  /** `POST /auth/invite` — the plaintext token arrives in the response, once. */
  createInvite(body: CreateInviteBody): Promise<IssuedInvite> {
    return api.post<IssuedInvite>('/auth/invite', body).then((r) => r.data);
  },

  /** `GET /auth/invite/list?tenantId=…` — pending invites for one salon. */
  listInvites(tenantId: string): Promise<PendingInvite[]> {
    return api
      .get<PendingInvite[]>('/auth/invite/list', { params: { tenantId } })
      .then((r) => r.data);
  },

  /** `DELETE /auth/invite/:id?tenantId=…` — revoke. 204, no body. */
  revokeInvite(id: string, tenantId: string): Promise<void> {
    return api.delete(`/auth/invite/${id}`, { params: { tenantId } }).then(() => undefined);
  },
};
