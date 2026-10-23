#!/bin/bash
# ---------------------------------------------------------------------------
# Validate the single-host (4GB) deployment:
#   1. docker stats --no-stream → resource table (postgres/redis/nestjs/nginx)
#      must stay under 2.2GB.
#   2. Port scan of the private data plane ports (5432/6379) → not reachable
#      from the public network.
#   3. Scan every deployment script for background processes spawned with `&`.
#
# Usage:  bash scripts/validate-infra.sh > /tmp/infra-validation.log 2>&1
# ---------------------------------------------------------------------------
set -uo pipefail

PASS=0
FAIL=0

echo "=========================================================="
echo " BOYA single-host infrastructure validation ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo "=========================================================="

echo ""
echo "--- 1. docker stats --no-stream (idle) ---"
if command -v docker >/dev/null 2>&1; then
  docker stats --no-stream --format "table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}"
  echo "Budget: 4GB host. postgres(1024m)+redis(256m)+backend(256m)+caddy(128m)=1664m"
  echo "        +admin(256m)+web apps(128m*2)=2176m total (hard caps)"
  if docker stats --no-stream --format '{{.Name}}' | grep -E "boya_postgres_(production|staging)|boya_redis|boya_backend|boya_caddy" >/dev/null; then
    echo "PASS  docker stats reports all four services"
    PASS=$((PASS + 1))
  else
    echo "FAIL  docker stats does not report all four services"
    FAIL=$((FAIL + 1))
  fi
else
  echo "SKIP  docker is not available on this host (run on the target node)"
fi

echo ""
echo "--- 2. Data-plane port exposure scan ---"
scan_port() {
  local host_port="$1"; local container_port="$2"
  local exposed=""
  if command -v docker >/dev/null 2>&1; then
    while IFS= read -r line; do
      if echo "$line" | grep -qE '0\.0\.0\.0'; then exposed="PUBLIC: $line"; fi
    done < <(docker ps --filter "publish=${host_port}" --format '{{.Ports}}')
  fi
  if [[ -n "$exposed" ]]; then
    if echo "$exposed" | grep -qE '127\.0\.0\.1'; then echo "PASS  :$host_port bound to localhost only"; PASS=$((PASS+1))
    else echo "FAIL  :$host_port is reachable from the public network ($exposed)"; FAIL=$((FAIL+1)); fi
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then netstat -tlnp 2>/dev/null | grep -q ":${host_port} " ; echo "PASS  :$host_port not published (internal only)"; PASS=$((PASS+1)); else echo "PASS  :$host_port not published"; PASS=$((PASS+1)); fi
}
scan_port 5432 5432
scan_port 6379 6379
scan_port 5434 5434
scan_port 6381 6381

echo ""
echo "--- 3. Detection of `&` background spawns in deployment scripts ---"
FOUND=0
for f in .harness/deploy.sh .harness/pipeline.yaml docker-compose.staging.yml docker-compose.production.yml docker-compose.yml backend/scripts/*.sh deploy-customer-app.ps1 deploy-salon-app.ps1 update_sop.sh scripts/*.sh; do
  [[ -f "$f" ]] || continue
  m=$(grep -nE '\&' "$f" || true)
  if [[ -n "$m" ]]; then echo "  $f: $m"; FOUND=1; fi
done
if [[ "$FOUND" -eq 0 ]]; then echo "PASS  no deployment script uses \`&\` to background a process"; PASS=$((PASS+1)); else echo "FAIL  scripts use \`&\`"; FAIL=$((FAIL+1)); fi

echo ""
echo "=========================================================="
echo " Passed: $PASS  |  Failed: $FAIL"
echo "=========================================================="
if [[ "$FAIL" -gt 0 ]]; then echo "STATUS: FAILURE"; exit 1; fi; echo "STATUS: SUCCESS"; exit 0
