# Dockerfile for shadcn MCP server

# 1. Builder stage
FROM node:20-slim AS builder

# Create a non-root user
RUN useradd -m appuser

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy all package manifests for a full workspace install
COPY tsconfig.json package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shadcn/package.json shadcn/tsconfig.json shadcn/tsup.config.ts ./shadcn/

# Install all dependencies for the shadcn workspace package
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY shadcn ./shadcn

# Build the project
WORKDIR /app/shadcn
RUN pnpm run build

# 2. Final image
FROM node:20-slim

# Create a non-root user
RUN useradd -m appuser

WORKDIR /app

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Copy over the package manifests and the entire built shadcn app
COPY --from=builder /app/pnpm-lock.yaml .
COPY --from=builder /app/pnpm-workspace.yaml .
COPY --from=builder /app/package.json .
COPY --from=builder /app/shadcn ./shadcn

# Install pnpm globally
RUN npm install -g pnpm

# This allows pnpm to correctly link workspace packages.
RUN pnpm install --prod

# Switch to the non-root user
USER appuser

CMD ["/app/entrypoint.sh"]