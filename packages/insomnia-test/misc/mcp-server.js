#!/usr/bin/env node
"use strict";

const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const z = require("zod/v4");

const HTTPS_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-cert.pem")),
};

function getServer() {
  const server = new McpServer({ name: "deepwiki-mock", version: "1.0.0" });

  server.registerTool(
    "read_wiki_structure",
    {
      description: "Get a list of documentation topics for a GitHub repository",
      inputSchema: {
        repoName: z.string().describe("GitHub repository: owner/repo"),
      },
    },
    async ({ repoName }) => {
      const text = `Available pages for ${repoName}\n\n- Overview\n- Getting Started\n- Architecture\n- API Reference`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { result: text },
        isError: false,
      };
    },
  );

  server.registerTool(
    "read_wiki_contents",
    {
      description: "View documentation about a GitHub repository",
      inputSchema: {
        repoName: z.string().describe("GitHub repository: owner/repo"),
        page: z.string().optional().describe("Page to read"),
      },
    },
    async ({ repoName, page }) => {
      const text = `Documentation for ${repoName}${page ? ` (${page})` : ""}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { result: text },
        isError: false,
      };
    },
  );

  server.registerTool(
    "ask_question",
    {
      description: "Ask a question about a GitHub repository",
      inputSchema: {
        repoName: z.string().describe("GitHub repository: owner/repo"),
        question: z.string().describe("Question to ask"),
      },
    },
    async ({ repoName, question }) => {
      const text = `Answer regarding ${repoName}: ${question}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { result: text },
        isError: false,
      };
    },
  );

  return server;
}

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("mcp-server ok");
});

const MAX_REPLY_DELAY_MS = 60_000;

async function delayResponse(req) {
  const delayMs = Math.min(
    Number(req.headers["x-reply-delay-ms"]) || 0,
    MAX_REPLY_DELAY_MS,
  );
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

app.post("/mcp", async (req, res) => {
  await delayResponse(req);
  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    process.stderr.write(`Error handling MCP request: ${error}\n`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32_603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32_000, message: "Method not allowed." },
      id: null,
    }),
  );
});

const PORT = process.env.MCP_PORT || 4020;
const SECURE_PORT = process.env.MCP_SECURE_PORT || 4021;

app.listen(PORT, () => {
  process.stdout.write(
    `MCP mock server listening at http://localhost:${PORT}\n`,
  );
});
https.createServer(HTTPS_OPTIONS, app).listen(SECURE_PORT, () => {
  process.stdout.write(
    `MCP mock server listening at https://localhost:${SECURE_PORT}\n`,
  );
});
