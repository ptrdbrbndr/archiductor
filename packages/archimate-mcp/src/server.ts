/**
 * archimate-mcp — HTTP/SSE MCP server
 *
 * Exposes 15 ArchiMate tools to Claude via the Model Context Protocol.
 * Transport: HTTP with Server-Sent Events (SSE) via @modelcontextprotocol/sdk
 *
 * Environment variables (required):
 *   SUPABASE_URL         — Supabase project URL
 *   SUPABASE_SERVICE_KEY — Supabase service role key (bypasses RLS)
 *   MCP_JWT_SECRET       — HMAC secret for JWT signing (min 32 chars recommended)
 *
 * Optional:
 *   PORT                 — HTTP port (default: 3100)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import http from "node:http";
import { registerTools } from "./tools/index.js";

const PORT = parseInt(process.env["PORT"] ?? "3100", 10);

// ---------------------------------------------------------------------------
// Validate required env vars at startup — fail fast, no silent success
// ---------------------------------------------------------------------------

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "MCP_JWT_SECRET"] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[archimate-mcp] FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Create MCP server
// ---------------------------------------------------------------------------

const mcpServer = new McpServer({
  name: "archimate-mcp",
  version: "0.0.1",
});

registerTools(mcpServer);

// ---------------------------------------------------------------------------
// HTTP server — handles SSE transport per connection
// ---------------------------------------------------------------------------

// Map of session ID → active SSEServerTransport
const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "archimate-mcp", version: "0.0.1" }));
    return;
  }

  // SSE endpoint — Claude connects here to open a streaming session
  if (req.method === "GET" && url.pathname === "/sse") {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    res.on("close", () => {
      transports.delete(transport.sessionId);
    });

    await mcpServer.connect(transport);
    return;
  }

  // Message endpoint — Claude sends tool calls here
  if (req.method === "POST" && url.pathname === "/messages") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Session ${sessionId} not found or expired` }));
      return;
    }

    await transport.handlePostMessage(req, res);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(PORT, () => {
  console.log(`[archimate-mcp] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[archimate-mcp] SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`[archimate-mcp] Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`[archimate-mcp] Tools registered: 15 (8 read + 7 write)`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[archimate-mcp] Received SIGTERM — shutting down");
  httpServer.close(() => {
    console.log("[archimate-mcp] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[archimate-mcp] Received SIGINT — shutting down");
  httpServer.close(() => {
    process.exit(0);
  });
});
