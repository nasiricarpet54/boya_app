#!/usr/bin/env bash
# Manual SQL verification of the referral + loyalty schema.
# Requires: docker compose up -d, migrations applied (npm run typeorm -- migration:run).
#
# SQL only: no application process is needed. The app connects as `beauty`,
# which is the container superuser and therefore bypasses RLS, so this script
# sets `app.current_tenant_id` by hand to mirror what the app does.

set -euo pipefail

PSQL="docker compose exec -T postgres psql -U beauty -d beauty_platform"

TENANT='11111111-1111-1111-1111-111111111111'
USER_A='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'   # referrer
USER_B='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'   # referred
CODE='BOYA7K3M9P'

echo "=== 0. Both tables must exist and must NOT have RLS ==="
$PSQL -c "
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename IN ('referrals', 'loyalty_points');
"
# Expected: referrals / loyalty_points, both rowsecurity = f

echo "=== 0b. Both tables are readable without any tenant setting ==="
$PSQL -c "SELECT COUNT(*) AS referrals_visible FROM referrals;"
$PSQL -c "SELECT COUNT(*) AS loyalty_visible FROM loyalty_points;"
# Expected: numbers, not a permission error and not an RLS-filtered 0-by-accident.

echo "=== 1. Fixtures: one tenant and two customers ==="
$PSQL <<SQL
SET app.current_tenant_id = '${TENANT}';
INSERT INTO tenants (id, name) VALUES ('${TENANT}', 'Test Salon')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, tenant_id, full_name, phone, role) VALUES
  ('${USER_A}', '${TENANT}', 'Referrer', '09120000010', 'customer'),
  ('${USER_B}', '${TENANT}', 'Referred', '09120000011', 'customer')
  ON CONFLICT (id) DO NOTHING;
DELETE FROM loyalty_points WHERE user_id IN ('${USER_A}', '${USER_B}');
DELETE FROM referrals WHERE referrer_id = '${USER_A}';
SQL

echo "=== 2. Referrer generates a code (pending, one reward per side) ==="
$PSQL -c "
  INSERT INTO referrals (referrer_id, referral_code, referrer_reward, referred_reward, status, expires_at)
  VALUES ('${USER_A}', '${CODE}', 500000, 300000, 'pending', NOW() + INTERVAL '90 days');
"

echo "=== 3. Referred user consumes the code: referred_id is bound, still pending ==="
$PSQL -c "
  UPDATE referrals
  SET referred_id = '${USER_B}'
  WHERE referral_code = '${CODE}' AND status = 'pending' AND referred_id IS NULL
  RETURNING id, referred_id, status;
"

echo "=== 4. A second user cannot reuse the same code (0 rows updated) ==="
$PSQL -c "
  UPDATE referrals
  SET referred_id = '${USER_A}'
  WHERE referral_code = '${CODE}' AND status = 'pending' AND referred_id IS NULL
  RETURNING id;
"
# Expected: no rows, because referred_id is already set. This is the guard
# ReferralService.applyCode relies on.

echo "=== 5. First captured payment completes the referral (conditional claim) ==="
$PSQL -c "
  UPDATE referrals
  SET status = 'completed', completed_at = NOW()
  WHERE referral_code = '${CODE}' AND status = 'pending'
  RETURNING id, status, completed_at;
"

echo "=== 6. Loyalty ledger: one earned row per user, expiry 365 days out ==="
$PSQL -c "
  INSERT INTO loyalty_points (user_id, points, type, source, description, expires_at)
  VALUES
    ('${USER_A}', 500, 'earned', 'referral', 'پاداش معرفی دوست', NOW() + INTERVAL '365 days'),
    ('${USER_B}', 300, 'earned', 'referral', 'پاداش خوش‌آمدگویی', NOW() + INTERVAL '365 days');
"

echo "=== 7. Balances (the same SUM the service runs) ==="
$PSQL -c "
  SELECT user_id,
         COALESCE(SUM(
           CASE
             WHEN type = 'earned' AND (expires_at IS NULL OR expires_at > NOW()) THEN points
             WHEN type = 'spent' THEN -points
             ELSE 0
           END
         ), 0) AS balance
  FROM loyalty_points
  WHERE user_id IN ('${USER_A}', '${USER_B}')
  GROUP BY user_id;
"
# Expected: referrer 500, referred 300 (the same formula the service runs:
# live earned adds, spent subtracts, 'expired' rows are audit bookkeeping).

echo "=== 8. Re-running step 5 is a no-op (idempotent completion) ==="
$PSQL -c "
  UPDATE referrals
  SET status = 'completed', completed_at = NOW()
  WHERE referral_code = '${CODE}' AND status = 'pending'
  RETURNING id;
"
# Expected: no rows. ReferralService flips status in the same conditional way,
# so a repeated Zarinpal callback cannot pay the reward twice.

echo "=== 9. The expiry sweep can only cancel a grant once ==="
$PSQL -c "
  UPDATE loyalty_points
  SET expires_at = NOW() - INTERVAL '1 day'
  WHERE user_id = '${USER_B}' AND type = 'earned';
  INSERT INTO loyalty_points (user_id, points, type, source, source_id, description, expires_at)
  SELECT user_id, points, 'expired', source, id, 'انقضای امتیاز', NULL
  FROM loyalty_points
  WHERE user_id = '${USER_B}' AND type = 'earned' AND expires_at <= NOW()
  ON CONFLICT DO NOTHING;
  INSERT INTO loyalty_points (user_id, points, type, source, source_id, description, expires_at)
  SELECT user_id, points, 'expired', source, id, 'انقضای امتیاز', NULL
  FROM loyalty_points
  WHERE user_id = '${USER_B}' AND type = 'earned' AND expires_at <= NOW()
  ON CONFLICT DO NOTHING;
"
$PSQL -c "
  SELECT type, COUNT(*) FROM loyalty_points WHERE user_id = '${USER_B}' GROUP BY type ORDER BY type;
"
# Expected: earned 1, expired 1. uq_loyalty_points_expiry_once blocks the second
# insert, which is why expireOldPoints() is safe to run every night.

echo "=== 10. Final state ==="
$PSQL -c "
  SELECT referral_code, status, referrer_reward, referred_reward, (referred_id IS NOT NULL) AS bound
  FROM referrals WHERE referrer_id = '${USER_A}';
"
$PSQL -c "
  SELECT user_id,
         COALESCE(SUM(
           CASE
             WHEN type = 'earned' AND (expires_at IS NULL OR expires_at > NOW()) THEN points
             WHEN type = 'spent' THEN -points
             ELSE 0
           END
         ), 0) AS balance
  FROM loyalty_points
  WHERE user_id IN ('${USER_A}', '${USER_B}')
  GROUP BY user_id;
"
# Expected: referrer 500, referred 0 (their grant lapsed in step 9 and its
# 'expired' row is audit bookkeeping that does not subtract again)

echo "=== Referral SQL verification complete ==="
