import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/profile_user.dart';

/// Auth only confirms the OTP. Name, points, and avatar are not returned.
final currentUserProvider = Provider<AsyncValue<ProfileUser>>(
  (ref) => const AsyncData(ProfileUser(fullName: '', phone: '')),
);
