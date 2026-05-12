FROM node:20-alpine
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package*.json ./
COPY packages/archimate-mcp/package.json ./packages/archimate-mcp/

# Install only the dependencies needed by this package
RUN npm ci --workspace=packages/archimate-mcp --include-workspace-root

# Copy source
COPY packages/archimate-mcp ./packages/archimate-mcp
COPY tsconfig.base.json ./

# Build
RUN npm run build -w packages/archimate-mcp

EXPOSE 3100

CMD ["node", "packages/archimate-mcp/dist/server.js"]
