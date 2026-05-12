FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
# Copy all workspace package.json files so npm workspaces resolution succeeds
COPY packages/archimate-mcp/package.json ./packages/archimate-mcp/
COPY packages/archimate-js/package.json ./packages/archimate-js/
COPY packages/archimate-js-react/package.json ./packages/archimate-js-react/
COPY packages/uml-js/package.json ./packages/uml-js/
RUN npm ci
COPY packages/archimate-mcp/ ./packages/archimate-mcp/
RUN npm run build -w packages/archimate-mcp

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/archimate-mcp/dist ./dist
EXPOSE 3100
CMD ["node", "dist/server.js"]
