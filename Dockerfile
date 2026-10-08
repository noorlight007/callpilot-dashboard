# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_TELNYX_API_KEY
ARG NEXT_PUBLIC_TELNYX_PUBLIC_KEY
ARG NEXT_PUBLIC_TELNYX_CALL_CONTROL_APP_ID
ARG NEXT_PUBLIC_TELNYX_CREDENTIAL_CONNECTION_ID
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_TELNYX_API_KEY=$NEXT_PUBLIC_TELNYX_API_KEY \
    NEXT_PUBLIC_TELNYX_PUBLIC_KEY=$NEXT_PUBLIC_TELNYX_PUBLIC_KEY \
    NEXT_PUBLIC_TELNYX_CALL_CONTROL_APP_ID=$NEXT_PUBLIC_TELNYX_CALL_CONTROL_APP_ID \
    NEXT_PUBLIC_TELNYX_CREDENTIAL_CONNECTION_ID=$NEXT_PUBLIC_TELNYX_CREDENTIAL_CONNECTION_ID \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build

# ---- run ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
