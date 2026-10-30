# INCIDENT 2026-10-31: Redesign home UI without running analyze

## Summary

Two commits were pushed to `master` WITHOUT running `fvm flutter analyze` first:

- `eadd0c3`  feat(customer_app): redesign home and search screen UI
- `8cdb123`  feat(customer_app): add BoyaHeader and BoyaSalonCard shared widgets

Result: `fvm flutter analyze` reported **73 issues (47 errors)**. Repo `master` was broken for any developer or CI pipeline that pulled it.

## Root Cause

Skipped the mandatory `fvm flutter analyze` check before commit. Violated:
- **R11** (Regress Test mandatory)
- **Section 19.2** checklist item "fvm flutter analyze without errors"

The AUDIT that preceded the commit only inspected `git diff --stat` and untracked `.png|jpg|svg` files. It did not include `fvm flutter analyze` and did not check for untracked `.dart` files (the two new widget files were initially missed).

## Actions Taken

1. `git branch backup/redesign-home 8cdb123`  preserved redesign work
2. `git push origin backup/redesign-home`  backed up to GitHub
3. `git revert --no-edit 8cdb123 eadd0c3`  created two revert commits (`dfe3cda`, `e380a2e`)
4. `fvm flutter analyze`  **No issues found, EXIT_CODE: 0**
5. `git push origin master`  `8cdb123..e380a2e` (repo restored)

Production was never affected: the redesign was never deployed (analyze failed before build).

## Missing API / Errors to fix before retry

### BoyaColors (from `mobile/shared/lib/theme/`)

Getters referenced but not defined:
- `background`
- `accentRose`
- `accentSilk`
- `textMain`
- `textSecondary`
- `border`

### BoyaTypography

Getters referenced but not defined:
- `heading1`
- `bodySmall`
- `labelBold`

### BoyaSalonCard constructor mismatch

Expected by `home_screen.dart` and `search_screen.dart`:
- `salon`, `isWishlisted`, `onBookNow`, `onToggleWishlist`, `viewPortfolio`

Provided by current `boya_salon_card.dart`:
- `name`, `district`, `coverUrl`, `rating`, `reviewsCount`, `isApproved`, `onBookTapped`, `onViewPortfolio`

### Internal bugs in `boya_salon_card.dart`

- Line 15: `final_not_initialized_constructor`  `onViewPortfolio` field missing
- Line 21: `initializing_formal_for_non_existent_field`  `viewPortfolio` doesn't exist

### Test

- `test/widget_test.dart:23`  `homeSalonsProvider` undefined

## Lessons Learned

**New mandatory rule (to be added to Section 19.2):**

> Before any `feat(...)` or `fix(...)` commit that touches `mobile/`:
> 1. Run `fvm flutter analyze`  **EXIT_CODE must be 0**
> 2. If EXIT_CODE != 0  fix errors or revert, NEVER commit
> 3. Also check `git status --porcelain` for untracked `.dart` files that may be imported by modified files

**AUDIT script fix:**

The previous untracked-file filter only matched `\.(png|jpg|svg|ttf|json)$`. It MUST also match `\.dart$` and `\.yaml$`.

## Next Steps

1. Work on `backup/redesign-home` in a new branch `feat/redesign-home`
2. Fix each error group separately:
   - Add missing `BoyaColors`/`BoyaTypography` getters in `mobile/shared/lib/theme/`
   - Align `BoyaSalonCard` constructor with call sites
   - Fix `search_screen.dart` and `test/widget_test.dart`
3. After EACH fix: `fvm flutter analyze`  EXIT_CODE 0
4. Only merge to master when analyze is clean
5. Then build web + deploy with backup

## References

- Revert commits: `dfe3cda`, `e380a2e`
- Backup branch: `backup/redesign-home` (on GitHub)
- Production at time of incident: `d94d087` (unchanged, safe)