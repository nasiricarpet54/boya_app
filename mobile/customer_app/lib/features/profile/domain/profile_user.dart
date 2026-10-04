class ProfileUser {
  const ProfileUser({required this.fullName, required this.phone});

  final String fullName;
  final String phone;

  String get initial {
    final trimmed = fullName.trim();
    return trimmed.isEmpty ? 'ب' : trimmed.substring(0, 1);
  }
}
