---
name: ui-finish-gate
description: Final UI quality gate before release. Checks design system consistency, accessibility, and asset optimization in Flutter.
---

## Gate Checklist
1. **Design Tokens**: Colors, spacing, and typography match the shared design system. No hardcoded values.
2. **Accessibility**: All text has sufficient contrast (WCAG AA). Touch targets >= 48dp. Semantics labels present for icons.
3. **Responsive**: Layout works on small (320dp) and large (tablet) screens.
4. **Assets**: All images are WebP or optimized SVG. No raw PNG/JPEG in `assets/`.
5. **Micro-interactions**: Animations are smooth (60fps) and non-blocking.

## Output
UI Finish Gate Report
[BLOCKER]: ...
[SUGGESTION]: ...
[NIT]: ...

Final verdict: PASS or FAIL (list blocking reasons).