#!/usr/bin/env bash
set -uo pipefail
TAG="${1:?usage: boya-verify.sh <tag> [tests]}"
RUN_TESTS="${2:-none}"
ROOT="${BOYA_ROOT:-/opt/boya}"
OUT="$ROOT/_verify/$TAG"
STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT"

save_cmd() {
    local name="$1"; shift
    local out code
    out="$("$@" 2>&1)"; code=$?
    { printf 'COMMAND: %s\nEXIT_CODE: %s\nTIMESTAMP: %s\n----\n\n%s\n' \
        "$*" "$code" "$(date -Iseconds)" "$out"; } > "$OUT/${STAMP}-${name}.txt"
    echo "[$name] exit=$code -> $OUT/${STAMP}-${name}.txt"
}
cd "$ROOT" || { echo "Cannot cd $ROOT"; exit 1; }

for c in git-status git-log git-head git-diff-stat git-diff git-staged-stat git-untracked git-stash-list git-reflog; do
    save_cmd "$c" bash -c "git ${c#git-}" 2>/dev/null || save_cmd "$c" bash -c "git $(echo $c | sed 's/git-//; s/-/ /g')"
done

run_tests() {
    case "$1" in
        backend)  ( cd "$ROOT/backend"             && save_cmd test-backend  bash -c 'npm test -- --passWithNoTests --ci 2>&1' ) ;;
        shared)   ( cd "$ROOT/mobile/shared"       && save_cmd test-shared   bash -c 'fvm flutter test --reporter expanded 2>&1' ) ;;
        customer) ( cd "$ROOT/mobile/customer_app" && save_cmd test-customer bash -c 'fvm flutter test --reporter expanded 2>&1' ) ;;
        salon)    ( cd "$ROOT/mobile/salon_app"    && save_cmd test-salon    bash -c 'fvm flutter test --reporter expanded 2>&1' ) ;;
        all)      run_tests backend; run_tests shared; run_tests customer; run_tests salon ;;
    esac
}
[ "$RUN_TESTS" != "none" ] && run_tests "$RUN_TESTS"
echo -e "\nSnapshot: $OUT\nNow run Cursor, then re-run with <tag>-after."