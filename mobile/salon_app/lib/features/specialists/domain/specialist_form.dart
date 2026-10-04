import 'package:boya_shared/boya_shared.dart';

import 'salon_specialist.dart';

/// The editable state of the specialist create/edit form.
///
/// The class owns the normalisation and the validation so the screen only
/// has to wire controllers to it: [normalisedPhone] converts Persian and
/// Arabic-Indic digits (and the common separators) to the Latin `09…` form
/// the backend expects, and the three `validate…` methods return the Persian
/// error message the field should show, or `null` when the value is good.
///
/// On edit [phone] is null and [specialistId] is set — the backend's
/// `PATCH /salon/me/specialists/:id` takes bio, skills and commission only,
/// so the create-only fields are dropped the moment the form becomes an edit.
class SpecialistForm {
  SpecialistForm({
    this.specialistId,
    this.fullName = '',
    this.phone = '',
    this.bio = '',
    List<String>? skills,
    this.commissionRate,
  }) : skills = skills ?? [];

  /// Adapts a loaded specialist for the edit form: identity for the header,
  /// editable fields for the controllers.
  factory SpecialistForm.fromSpecialist(SalonSpecialist specialist) {
    return SpecialistForm(
      specialistId: specialist.id,
      fullName: specialist.fullName ?? '',
      phone: specialist.phone ?? '',
      bio: specialist.bio ?? '',
      skills: List<String>.of(specialist.skills),
      commissionRate: specialist.commissionRate,
    );
  }

  /// Backend specialist id — set only when editing.
  final String? specialistId;

  bool get isEditing => specialistId != null;

  String fullName;
  String phone;
  String bio;
  List<String> skills;

  /// Null means "use the default", which is what create sends when the field
  /// was left untouched.
  double? commissionRate;

  static const double defaultCommissionRate = 50;

  static final _latinPhone = RegExp(r'^09[0-9]{9}$');

  /// The phone as the backend stores it: Latin digits, no spaces or dashes,
  /// `+98`/`0098`/`912…` rewritten to a leading `0` — the same rules as
  /// `normalizePhone` on the backend.
  String get normalisedPhone {
    var value = toLatinDigits(phone).trim().replaceAll(RegExp(r'[\s\-().]'), '');
    if (value.startsWith('+98')) value = '0${value.substring(3)}';
    if (value.startsWith('0098')) value = '0${value.substring(4)}';
    if (value.startsWith('98') && value.length == 12) value = '0${value.substring(2)}';
    if (RegExp(r'^[0-9]{10}$').hasMatch(value)) value = '0$value';
    return value;
  }

  String? validateFullName() {
    final value = fullName.trim();
    if (value.isEmpty) return 'نام متخصص را وارد کنید';
    if (value.length > 200) return 'نام متخصص طولانی است';
    return null;
  }

  String? validatePhone() {
    final value = normalisedPhone;
    if (value.isEmpty) return 'شماره موبایل متخصص را وارد کنید';
    if (!_latinPhone.hasMatch(value)) return 'شماره موبایل وارد شده معتبر نیست';
    return null;
  }

  /// Parses the commission field, which may arrive with Persian digits.
  /// Returns the parsed percentage, or null when the text is unusable.
  double? parseCommission(String raw) => double.tryParse(toLatinDigits(raw).trim());

  String? validateCommission(double? value) {
    if (value == null) return 'پورسانت را به عدد وارد کنید';
    if (value < 0 || value > 100) return 'پورسانت باید بین ۰ تا ۱۰۰ باشد';
    return null;
  }

  /// Create payload — exactly the fields `POST /salon/me/specialists` accepts.
  /// `forbidNonWhitelisted` on the backend rejects anything extra, so the
  /// form never grows a key here that the DTO does not know.
  Map<String, dynamic> toCreatePayload() => <String, dynamic>{
        'phone': normalisedPhone,
        'fullName': fullName.trim(),
        'bio': bio.trim(),
        'skills': skills,
        'commissionRate': commissionRate ?? defaultCommissionRate,
      };

  /// Edit payload — `PATCH /salon/me/specialists/:id` accepts no more than
  /// these three.
  Map<String, dynamic> toUpdatePayload() => <String, dynamic>{
        'bio': bio.trim(),
        'skills': skills,
        'commissionRate': commissionRate ?? defaultCommissionRate,
      };
}
