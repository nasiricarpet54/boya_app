import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthService, redirectRouteFor } from './auth.service';
import { OtpService } from './otp.service';
import { RefreshTokenService } from './refresh-token.service';
import { InviteTokenService } from './invite-token.service';
import type { AuthenticatedUser } from './guards/jwt-auth.guard';

/** A `DataSource` whose only real behaviour is what the unit under test needs. */
class FakeDataSource {
  /** sql → rows, in call order; each `query` pops the next reply. */
  replies: Array<Record<string, unknown>[]> = [];
  query = jest.fn(async () => this.replies.shift() ?? []);

  transaction = jest.fn();
}

const issued = {
  accessToken: 'access',
  refreshToken: 'refresh',
  familyId: 'family',
  refreshExpiresAt: new Date('2030-01-01T00:00:00Z'),
};

const tokenService = {
  issue: jest.fn(async () => issued),
  rotate: jest.fn(),
  revoke: jest.fn(),
  revokeAll: jest.fn(),
} as unknown as RefreshTokenService;

const otpService = { verifyOtp: jest.fn(async () => undefined) } as unknown as OtpService;
const inviteService = {} as unknown as InviteTokenService;

const userRow = {
  id: '11111111-1111-1111-1111-111111111111',
  phone: '09120000000',
  full_name: 'کارشناس آزمایش',
  role: 'specialist',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  is_new: false,
};

describe('AuthService role routing', () => {
  let service: AuthService;
  let dataSource: FakeDataSource;

  beforeEach(() => {
    dataSource = new FakeDataSource();
    jest.clearAllMocks();
    dataSource.query.mockImplementation(async () => dataSource.replies.shift() ?? []);
    service = new AuthService(
      otpService,
      {} as JwtService,
      dataSource as never,
      tokenService,
      inviteService,
    );
  });

  const tokenOf = (role: string): AuthenticatedUser => ({
    userId: userRow.id,
    phoneNumber: userRow.phone,
    role: role as AuthenticatedUser['role'],
    tenantId: userRow.tenant_id,
  });

  it('answers login with activeRole, allowedRoles and redirectRoute', async () => {
    dataSource.replies = [[userRow]];

    const response = await service.verifyOtpAndIssueToken('09120000000', '1234');

    expect(response.activeRole).toBe('specialist');
    expect(response.allowedRoles).toEqual(['specialist']);
    expect(response.redirectRoute).toBe('/dashboard');
    expect(response.user.role).toBe('specialist');
  });

  it('switch-role: reissues for the role the account actually holds', async () => {
    dataSource.replies = [[userRow]];

    await service.switchRole(tokenOf('specialist'), 'specialist');

    expect(tokenService.issue).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'specialist', userId: userRow.id }),
    );
  });

  it('switch-role: 403 when the requested role is not on the account', async () => {
    // The whole point of the endpoint: a hand-made token claiming another role
    // must not be able to mint itself that role.
    dataSource.replies = [[userRow]];

    await expect(service.switchRole(tokenOf('specialist'), 'salon_owner')).rejects.toThrow(
      ForbiddenException,
    );
    expect(tokenService.issue).not.toHaveBeenCalled();
  });
});

describe('redirectRouteFor', () => {
  // Every staff role shares the single salon panel (ADR-003/ADR-008); the
  // panel separates roles inside itself, so they share its dashboard route.
  it.each([
    'salon_owner',
    'line_manager',
    'specialist',
    'employed',
    'booth_renter',
    'freelance_mobile',
  ])('sends %s to the salon panel dashboard', (role) => {
    expect(redirectRouteFor(role as never)).toBe('/dashboard');
  });

  it('sends customer home and promises no panel route to admins', () => {
    expect(redirectRouteFor('customer')).toBe('/');
    expect(redirectRouteFor('admin')).toBe('/');
    expect(redirectRouteFor('super_admin')).toBe('/');
  });
});
