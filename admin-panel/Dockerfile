FROM node:22-alpine AS builder
WORKDIR /app
ENV npm_config_registry=https://registry.npmmirror.com
COPY package*.json ./
RUN npm ci
COPY . .
# The repo has no `public/` directory; create it so the runtime COPY below
# never fails (Docker COPY has no `|| true` escape hatch).
RUN mkdir -p /app/public
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it must be
# present as an OS env var while `next build` runs — a runtime-only value would
# only reach SSR, never the browser bundle.
ARG NEXT_PUBLIC_API_URL=https://boya.bcshopir.ir/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./
EXPOSE 3001
# `npm run start` is `next start -p 3001` (see package.json), matching EXPOSE.
CMD ["npm", "run", "start"]