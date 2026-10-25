# UI/UX Validation Report - Vazirmatn Fonts, Phone Removal & Dio 401

**Date:** 2026-10-27  
**Apps Analyzed:** customer_app, salon_app, shared (boya_shared)  
**Brand:** Boya (بویا)

---

## ✅ Task 1: Salon Phone Removed from Customer Panel

**File:** `mobile/customer_app/lib/features/salon/presentation/screens/salon_detail_screen.dart`

**Change Applied:**
```dart
// REMOVED (lines 294, 336-339):
final phone = salon.phone;           // unused variable
if (phone != null && phone.isNotEmpty) ...[
  const SizedBox(height: 6),
  _HeaderLine(icon: Icons.phone_outlined, text: phone),
],
```

**Verification:**
- ✅ Phone display widget removed from `_SalonHeader`
- ✅ Unused variable warning eliminated
- ✅ `flutter analyze` passes with zero issues

**Rationale:** The salon's contact phone is internal data (used for management), not customer-facing. Customers use in-app booking flow instead.

---

## ✅ Task 2: Vazirmatn Font Integration (Brand Identity)

**Registry:** `mobile/shared/pubspec.yaml`

```yaml
flutter:
  uses-material-design: true
  fonts:
    - family: Vazirmatn
      fonts:
        - asset: assets/fonts/Vazirmatn-Regular.ttf
          weight: 400
        - asset: assets/fonts/Vazirmatn-Medium.ttf
          weight: 500
        - asset: assets/fonts/Vazirmatn-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/Vazirmatn-Bold.ttf
          weight: 700
```

**Path:** `mobile/shared/assets/fonts/`
- ✅ Vazirmatn-Regular.ttf (400)
- ✅ Vazirmatn-Medium.ttf (500)
- ✅ Vazirmatn-SemiBold.ttf (600)
- ✅ Vazirmatn-Bold.ttf (700)

**Brand Consistency:**
- Vazirmatn is the standard Persian/RTL font
- Weights align with Boya typography scale (body=400, title=600, headings=700)
- Fonts registered in shared package → available to all apps

---

## ✅ Task 3: Dio Interceptor 401 Handling

**File:** `mobile/customer_app/lib/core/network/api_client.dart`

**Existing Implementation Verified (ADR-009):**

```dart
@override
void onError(DioException err, ErrorInterceptorHandler handler) async {
  final status = err.response?.statusCode;
  // Skip refresh for auth endpoints (they answer 401 as the answer itself)
  if (status != 401 || _isPublic(path) || _authPaths.any(path.startsWith)) {
    handler.next(err);
    return;
  }

  final rotated = await _refreshOnce();  // single-flight rotation
  if (!rotated) {
    await _signOut();  // clears local session
    handler.next(err);
    return;
  }
  // Retry with new token...
}
```

**Flow:**
1. Request fails with 401
2. Interceptor tries token refresh (single-flight to prevent parallel rotations)
3. If refresh succeeds → retry original request with new token
4. If refresh fails → `_signOut()` clears session → GoRouter redirect catches unauthenticated state → user redirected to `/auth/login`

**Router Guard Integration** (`main.dart`):
```dart
redirect: (context, state) {
  final auth = container.read(authControllerProvider);
  if (auth.isRestoring) return null;
  final requiresAuth = _protectedPaths.any(state.matchedLocation.startsWith);
  if (requiresAuth && !auth.isAuthenticated) {
    return Uri(path: '/auth/login', queryParameters: {'returnTo': state.matchedLocation}).toString();
  }
  return null;
}
```

**Status:** ✅ Already correctly implemented - automatic redirect to login on 401

---

## ✅ Task 4: Flutter Analysis - Zero Issues

### Customer App
```bash
cd mobile/customer_app
flutter analyze
# ✅ No issues found! (ran in 16.9s)
```

**Fixes Applied During Audit:**
1. **promo_banner.dart:** `BoyaColors.sage` → `BoyaColors.success` (sage not in palette; success=#6F9A8D is Sage Green per brand)
2. **boya_location_picker.dart:** Fixed import paths (`../../../` → `../../../../`), removed broken theme import, added `latlong2` for `LatLng`, renamed `BookerLocationPicker` → `BoyaLocationPicker`
3. **pubspec.yaml:** Added `latlong2: ^0.10.1` dependency

### Salon App
```bash
cd mobile/salon_app
flutter analyze
# ✅ No issues found! (ran in 4.0s)
```

**Fixes Applied During Audit:**
1. **schedule_block_api.dart:** Removed unused `response` variable
2. **salon_shell.dart:** Renamed `_SalonTab` → `SalonTab` (private type in public API)

### Shared Package (boya_shared)
```bash
cd mobile/shared
flutter analyze
# ✅ No issues found! (ran in 3.3s)
```

**Fixes Applied During Audit:**
1. **boya_theme.dart:** `radius:` → `borderRadius:` in `errorBorder` (OutlineInputBorder API)
2. **boya_logo.dart:** `BoyaColors.sage` → `BoyaColors.success` (brand palette consistency)

---

## 🎨 Brand Color Token Verification

| Token | Hex | Status |
|-------|-----|--------|
| Primary Petrol Teal | `#173B3F` | ✅ `BoyaColors.primary` |
| Warm Cream | `#F7F3EE` | ✅ `BoyaColors.cream` |
| Sage Green Success | `#6F9A8D` | ✅ `BoyaColors.success` |
| Rose Gold | `#D9A2B0` | ✅ `BoyaColors.rose` |
| Error Wine | `#B35D67` | ✅ `BoyaColors.error` |

**File:** `mobile/shared/lib/theme/boya_colors.dart` - all tokens verified ✅

---

## 📋 Summary

| Task | Status | Details |
|------|--------|---------|
| Remove salon phone from customer panel | ✅ DONE | `_SalonHeader` cleaned |
| Vazirmatn font registration | ✅ DONE | 4 weights in shared pubspec |
| Dio 401 → login redirect | ✅ DONE | ADR-009 interceptor verified |
| `flutter analyze` zero warnings | ✅ DONE | All 3 packages: "No issues found!" |

**Additional Fixes (pre-existing errors blocking zero-warning target):**
- 5 type/import errors in customer app
- 2 lint issues in salon app
- 2 errors in shared package

---

*Report generated: 2026-10-27*
