# Stage 1: Build the React application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.cjs ./server.cjs
COPY --from=builder /app/migrate.cjs ./migrate.cjs
COPY --from=builder /app/migrate_data.cjs ./migrate_data.cjs
COPY --from=builder /app/supabase_schema_backup.sql ./supabase_schema_backup.sql

EXPOSE 3000
CMD ["sh", "-c", "node migrate.cjs && node server.cjs"]

