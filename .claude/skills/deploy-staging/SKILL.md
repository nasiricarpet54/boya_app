---
name: deploy-staging
description: Deploy the current branch to the staging VPS via Docker Compose, run Playwright E2E tests, and report results.
---

## Deployment Steps (execute in order)
1. `git pull origin staging`
2. `docker compose -f docker-compose.staging.yml build`
3. `docker compose -f docker-compose.staging.yml up -d`
4. Wait 15 seconds for services to become healthy.
5. Run `npx playwright test` against staging URL.
6. If tests fail, immediately rollback: `docker compose down && docker compose up -d --build` with previous tag.
7. Report: deployment status, test pass/fail count, any BLOCKERS.

## Hard Rules
- Never deploy to production from this skill.
- Never use `&` to background processes.
- Always capture and report the Docker Compose logs for failed services.