# Multi-stage build: builder (full deps) -> slim runtime (prod deps + dist).
# NOTE: no "# syntax=docker/dockerfile:1" directive on purpose — BuildKit would
# fetch that frontend from docker.io, which is unreachable from this network.
# The bundled frontend is enough (no heredocs / --mount used here).

# ---- Builder ---------------------------------------------------------------
# Full install (devDependencies included): `nest build` needs the @nestjs/cli
# and typescript, which both live in devDependencies.
FROM node:22-alpine AS builder
WORKDIR /app
# The repo pins npm to a reliable mirror (see the root .npmrc), but that file is
# outside the backend build context. Apply the same registry here so the Docker
# build, CI and local dev all resolve packages from one place.
ENV npm_config_registry=https://registry.npmmirror.com
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime ---------------------------------------------------------------
# Slim image: production dependencies only + the compiled output.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_registry=https://registry.npmmirror.com
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
