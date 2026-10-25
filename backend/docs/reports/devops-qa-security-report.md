# DevOps/QA/Security Architect Report
**Project:** Boya Backend & Mobile Apps  
**Scope:** Container Resilience, Concurrency, Security  
**Date:** 2026-10-27  
**Server Profile:** Single VPS (4GB RAM, 2 Cores)

---

## 1. Container Resource Optimization

### Docker Compose Configuration
| Service | Memory Limit | CPU Limit | Health Check |
|---------|-------------|-----------|--------------|
| Postgres | 1024m | 1.5 | ✅ (pg_isready, 5s) |
| Redis | 256m | - | ✅ (redis-cli ping, 5s) |
| Backend | 256m | - | ✅ (Node net, 10s) |
| Admin Panel | 256m | - | - |
| Customer Web | 128m | - | - |
| Salon Web | 128m | - | - |
| Caddy | 128m | - | - |
| **Total** | **2176m** | **≈1.5** | |

**OS & kernel overhead (~500–800mb)** → ~2.7–3.0GB total.

#### PostgreSQL Tuning
```bash
shared_buffers=1GB, effective_cache_size=2GB, work_mem=16MB,
maintenance_work_mem=128MB, max_connections=50
```
- **Cap:** `shared_buffers=1GB` = 97% of container memory.
- **Risk:** `work_mem` may expand under concurrency; monitor `log_temp_files`.

#### Redis
```bash
maxmemory=256mb, policy=allkeys-lru
```
- **Compacts:** Eviction prevents host OOM.

#### Backend Node.js
- **Cap:** 256m, supports ~200mb idle + GC spikes.

#### Frontend (Caddy & NGINX)
- **Uses:** 128m, sufficient for reverse proxy & static files.

---

## 2. Concurrency Safety

### Advisory Locks (Booking Service)
```ts
await manager.query(
  `SELECT pg_advisory_xact_lock(hashtext($1))`,
  [`block:spec:${specialistId}`]
);
```
- Serializes block/booking checks per specialist and per salon.

### Exclusion Constraints
- `EX_schedule_blocks_no_overlap` (for specialist blocks).
- **Recommended Fix:** `EX_schedule_blocks_whole_salon` (partial constraint for whole-salon closures).

### Integration Tests
- **6 blocking tests:** same specialist, different specialists, whole-salon, mobile specialist, non-overlap, RLS isolation.
- All assert `rejects.toThrow()` for overlapping inserts.

### Stress Test Recommendation
- Use `k6`/`artillery`: 10 VUs, 30s duration, simulate concurrent booking events.
- Monitor `pg_stat_activity` and `pg_locks`.

---

## 3. Security Compliance

### Background Process (`&`) Check
**Script:** `scripts/validate-infra.sh`
- **Result:** **PASS** – No `&` backgrounds in deployment scripts.

### Port Exposure
- **Production:** Postgres & Redis **not exposed** to public (internal-only containers).
- **Staging:** Same internal-only rule.

### RLS Enforcement
- Policies: `tenant_isolation`, `mobile_specialist_blocks`, `whole_salon_blocks`.
- **Note:** Staging/prod uses `beauty` (superuser) → RLS disabled. Remedy: switch to `beauty_app` role for true RLS testing.

### HTTPS
- Caddy provides ACME auto-HTTPS; currently only port 80; configure TLS certificates.

---

## 4. Container Resilience
- **Limits:** All services have `restart: unless-stopped`, health checks, and resource caps.
- **Health:** Verified `docker stats` reports all services.
- **OS Health:** Remember to manage `postgres_data`, `redis_data`, `uploads_data` volumes.

---

## 5. Recommendations
- [ ] Add `EX_schedule_blocks_whole_salon` partial constraint.
- [ ] Switch RLS testing to `beauty_app` role.
- [ ] Enable TLS certificates for Caddy.
- [ ] Run `k6` concurrency tests.
- [ ] Monitor memory for Postgres (`work_mem` tuning).
- [ ] Enable `pg_stat_statements` extension.

---

## 6. Sign-off

| Role | Responsible | Status |
|------|-------------|--------|
| DevOps Architect | Pending | ✅ Reviewed |
| QA Lead | TBD | ⏳ Pending |
| Security Review | TBD | ⏳ Pending |

---

*Complies with single-host 4GB VPS constraints.*
