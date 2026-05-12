FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/archimate-mcp/package.json ./packages/archimate-mcp/
COPY tsconfig.base.json ./
RUN npm ci
COPY packages/archimate-mcp/ ./packages/archimate-mcp/
RUN npm run build -w packages/archimate-mcp

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/archimate-mcp/dist ./dist
EXPOSE 3100
CMD ["node", "dist/server.js"]
