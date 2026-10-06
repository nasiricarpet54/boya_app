import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Roles the salon panel may hand out with an invite (ADR-010).
///
/// Deliberately narrower than the backend's full `invite_role` enum: a
/// `salon_owner` or `line_manager` never invites another owner through this app
/// — the panel only onboards staff beneath them. The backend still validates
/// against its own wider list, so this is a UI convenience, not a security
/// boundary.
const Set<String> specialistInviteRoles = {'specialist', 'line_manager'};

/// One role choice shown in the invite form.
class InviteRoleOption {
  const InviteRoleOption({required this.value, required this.label});

  final String value;
  final String label;
}

const List<InviteRoleOption> specialistInviteRoleOptions = [
  InviteRoleOption(value: 'specialist', label: 'متخصص'),
  InviteRoleOption(value: 'line_manager', label: 'مدیر خط'),
];

/// What `POST /auth/invite` answers with. `token` is returned exactly once —
/// the database keeps only its SHA-256 hash, so a lost token cannot be
/// recovered, only revoked and re-issued.
class IssuedInvite {
  const IssuedInvite({
    required this.id,
    required this.token,
    required this.role,
    required this.tenantId,
    required this.expiresAt,
  });

  factory IssuedInvite.fromJson(Map<String, dynamic> json) => IssuedInvite(
        id: json['id'] as String? ?? '',
        token: json['token'] as String? ?? '',
        role: json['role'] as String? ?? 'specialist',
        tenantId: json['tenantId'] as String? ?? '',
        expiresAt:
            DateTime.tryParse(json['expiresAt'] as String? ?? '')?.toLocal(),
      );

  final String id;
  final String token;
  final String role;
  final String tenantId;
  final DateTime? expiresAt;
}

/// Issues staff invites for the signed-in salon.
///
/// The tenant is never sent by the client: the backend takes it from the JWT,
/// so a `salon_owner` can only ever invite into their own salon. The phone the
/// inviter types is the *target* — the invitee still proves it with an OTP
/// before the account is created.
class InviteApi {
  InviteApi(this._dio);

  final Dio _dio;

  /// `POST /auth/invite` — the plaintext token arrives in the response, once.
  Future<IssuedInvite> inviteSpecialist({
    required String phone,
    required String role,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/invite',
      data: <String, dynamic>{'phone': phone, 'role': role},
    );
    return IssuedInvite.fromJson(response.data ?? const {});
  }
}

final inviteApiProvider = Provider<InviteApi>(
  (ref) => InviteApi(ref.watch(dioProvider)),
);
