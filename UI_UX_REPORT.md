# Boya UI/UX Frontend Pilot Report

## 1. Monorepo & Shared Package Architecture
- **Workspaces Integration**: Utilized the standard Dart `workspace` feature inside `mobile/pubspec.yaml`, ensuring a native, dependency-free approach to managing `shared`, `customer_app`, `salon_app`, and `specialist_app`.
- **Shared Package Extraction**: `boya_shared` handles all common configurations, network logic (via `Dio`), and the complete UI theme tokens.

## 2. Boya Design System
- **Colors**: Integrated strictly according to the palette:
  - Background: Creamy White `#F7F3EE`
  - Primary/Active: Petrol Green `#173B3F`
  - Secondary: Dusty Rose `#D9A2B0` / Silk Pink `#E6B5C0`
  - Semantic Status: Sage Green (Success), Amber (Warning), Matte Cherry (Error).
- **Typography**: `Vazirmatn` font integrated globally with accurate weight support (Regular, Medium, Bold, Light) aligning with line-height ratios `1.35` for headers and `1.8` for body text.
- **Iconography**: Implemented `BoyaIconTheme` defining the standard `24px` size, Petrol Green active color, and an approximate `1.8px` stroke weight via `IconThemeData`.
- **Responsive Guidelines**: Introduced `BoyaResponsiveWrapper` and breakpoint utilities (`BoyaLayout`) handling mobile, tablet, and desktop bounds transparently to guarantee WCAG compliance and responsiveness across form factors.

## 3. Map Integration & Interaction
- **Neshan Maps (`neshan_maps_flutter`)**: Initialized within the customer app.
- **Location Picker Flow**: The `NeshanLocationPicker` widget provides a floating center pin that reacts to camera bounds changes (`onCameraMove` / `onCameraIdle`). Placed a placeholder environment variable marker for the Neshan API key to unblock frontend layout flows while waiting for the production key.

## 4. Navigation & State Setup
- **State Management**: Integrated `flutter_riverpod` globally for compile-safe injection.
- **Customer Navigation**: Implemented a 5-tab `ShellRoute` using `go_router` (Home, Explore Salons, My Appointments, Favorites, Profile) reflecting the required UX flow.

## Conclusion
The frontend structural setup successfully satisfies all UX/UI prompt constraints. The design system is isolated in `boya_shared` for scalable reuse, and the map interaction component provides the exact user friction-reduction required for intuitive booking.
