# ---- Builder Stage ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime Stage ----
FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# کپی خروجی بیلد از مرحله قبل
COPY --from=builder /app/dist ./dist
# کپی کل node_modules (اختیاری: اگر package.json را از builder کپی نکنید)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/main.js"]
