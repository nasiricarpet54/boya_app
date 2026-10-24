# Boya Specialist App - Isolation and UI Verification Report

## 1. UI/UX Consistency
The `specialist_app` seamlessly adopts the `boya_shared` design system (`BoyaTheme`):
- Features the mandated `Vazirmatn` font.
- Applies the core color palette natively (Petrol Green `#173B3F`, Creamy White `#F7F3EE`).
- UI icons automatically inherit the standardized `1.8px` stroke guidelines via the shared `BoyaIconTheme`.

## 2. Structural Access Control (Isolation)
The `specialist_app` represents a completely independent Flutter build target within the monorepo. It has its own explicitly defined `go_router` navigation shell:
- **Defined Routes**: Limited strictly to `/` (Schedule), `/clients` (My Clients), and `/profile` (Specialist Profile).
- **Hard UI Segregation**: There are zero dependencies on `salon_app` screens. No dashboard widgets, financial macro-reports, or salon configuration views are imported or accessible.
- **Security Posture**: By physically isolating the codebase into its own application entry point (`mobile/specialist_app/lib/main.dart`), it is impossible for a compiled specialist binary to render views reserved for salon administrators. Access control is enforced not just at the API level, but structurally at the frontend layer.
