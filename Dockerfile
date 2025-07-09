# Dockerfile for shadcn MCP server

# 1. Builder stage
FROM node:20 AS builder

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /app

# Copy all package manifests for a full workspace install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shadcn/package.json ./shadcn/
COPY tsconfig.json ./

# Install all dependencies for the shadcn workspace package
RUN pnpm install --frozen-lockfile --filter shadcn

# Copy the rest of the source code
COPY shadcn ./shadcn

# Build the project
WORKDIR /app/shadcn
RUN pnpm run build

# 2. Final image
FROM node:20-slim

WORKDIR /app


# Install pnpm globally
RUN npm install -g pnpm

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Copy over the package manifests and the entire built shadcn app
COPY --from=builder /app/pnpm-lock.yaml .
COPY --from=builder /app/pnpm-workspace.yaml .
COPY --from=builder /app/package.json .
COPY --from=builder /app/shadcn ./shadcn

# This allows pnpm to correctly link workspace packages.
RUN pnpm install --prod

# # Expose the port the app runs on
# EXPOSE 8080

CMD ["/app/entrypoint.sh"]