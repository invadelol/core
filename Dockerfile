FROM oven/bun:1 AS base

# All deps stage
FROM base AS deps
WORKDIR /app
ADD package.json bun.lock ./
RUN bun install --frozen-lockfile

# Production only deps stage
FROM base AS production-deps
WORKDIR /app
ADD package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
ADD . .
RUN bun ace docs:generate
RUN bun ace build
RUN cp swagger.yml build/

# Production stage
FROM base
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app
EXPOSE 8080
CMD ["bun", "./bin/server.js"]