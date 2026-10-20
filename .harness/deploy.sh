#!/bin/sh
apk add --no-cache docker-cli docker-cli-compose
echo "=== Starting deployment ==="
docker compose -f docker-compose.production.yml up -d --build
docker image prune -f
echo "=== Deployment finished successfully ==="
