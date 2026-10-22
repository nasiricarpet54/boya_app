#!/usr/bin/env bash
set -e

echo "=== ۱. همگام‌سازی شاخه master ==="
git fetch origin master
git reset --hard origin/master

echo "=== ۲. بیلد و راه‌اندازی سرویس‌ها ==="
# استفاده از متغیر محدودیت رم جهت جلوگیری از کرش V8/npm
export NODE_OPTIONS="--max-old-space-size=2048"

# بیلد ایمیج‌های وب و بک‌اند
docker compose -f docker-compose.production.yml up -d --build

echo "=== ۳. پاکسازی ایمیج‌های بی‌استفاده ==="
docker image prune -f

echo "=== استقرار با موفقیت انجام شد ==="
