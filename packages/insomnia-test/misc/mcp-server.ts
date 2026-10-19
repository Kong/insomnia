#!/usr/bin/env node

import fs from 'node:fs';
import https from 'node:https';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import * as z from 'zod/v4';

import { certPath } from './certs';
import type { McpListConfig, McpListMethod, McpListReply } from './mcp-list-server';

const HTTPS_OPTIONS = {
  key: fs.readFileSync(certPath('localhost-key.pem')),
  cert: fs.readFileSync(certPath('localhost-cert.pem')),
};

function getServer() {
  const server = new McpServer({ name: 'deepwiki-mock', version: '1.0.0' });

  server.registerTool(
    'read_wiki_structure',
    {
      description: 'Get a list of documentation topics for a GitHub repository',
      inputSchema: {
        repoName: z.string().describe('GitHub repository: owner/repo'),
      },
    },
    async ({ repoName }) => {
      const text = `Available pages for ${repoName}\n\n- Overview\n- Getting Started\n- Architecture\n- API Reference`;
      return {
        content: [{ type: 'text', text }],
        structuredContent: { result: text },
        isError: false,
      };
    },
  );

  server.registerTool(
    'read_wiki_contents',
    {
      description: 'View documentation about a GitHub repository',
      inputSchema: {
        repoName: z.string().describe('GitHub repository: owner/repo'),
        page: z.string().optional().describe('Page to read'),
      },
    },
    async ({ repoName, page }) => {
      const text = `Documentation for ${repoName}${page ? ` (${page})` : ''}`;
      return {
        content: [{ type: 'text', text }],
        structuredContent: { result: text },
        isError: false,
      };
    },
  );

  server.registerTool(
    'ask_question',
    {
      description: 'Ask a question about a GitHub repository',
      inputSchema: {
        repoName: z.string().describe('GitHub repository: owner/repo'),
        question: z.string().describe('Question to ask'),
      },
    },
    async ({ repoName, question }) => {
      const text = `Answer regarding ${repoName}: ${question}`;
      return {
        content: [{ type: 'text', text }],
        structuredContent: { result: text },
        isError: false,
      };
    },
  );

  return server;
}

// A loopback-only mock with no cookies or sessions, so there is no ambient
// credential for a cross-site request to ride on and CSRF tokens don't apply.
// nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).send('mcp-server ok');
});

const MIN_REPLY_DELAY_MS = 1;
const MAX_REPLY_DELAY_MS = 1000;

function delayResponse(req: express.Request) {
  const requestedDelayMs = Number(req.headers['x-reply-delay-ms']);
  if (!Number.isSafeInteger(requestedDelayMs)) return Promise.resolve();
  if (requestedDelayMs < MIN_REPLY_DELAY_MS || requestedDelayMs > MAX_REPLY_DELAY_MS) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, requestedDelayMs));
}

app.post('/mcp', async (req, res) => {
  await delayResponse(req);
  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    process.stderr.write(`Error handling MCP request: ${error}\n`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32_603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

app.get('/mcp', (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32_000, message: 'Method not allowed.' },
      id: null,
    }),
  );
});

// ---------------------------------------------------------------------------
// Scriptable list-response server (INS-3647).
//
// Every test talks to its own `/mcp-list/<key>` endpoint and scripts what the
// list requests answer through `PUT /mcp-list/<key>/config`, so malformed
// payloads can be served and switched between Refresh clicks. Unscripted list
// methods answer with a valid empty list.
//
// Config shape: { [method]: Reply | { pages: { [cursor]: Reply } } } where
// `Reply` is `{ result }` (any JSON, sent verbatim) or `{ error: { code, message } }`.
// For `pages`, the empty-string cursor is the first page.
// ---------------------------------------------------------------------------
const EMPTY_LISTS: Record<string, unknown> = {
  'tools/list': { tools: [] },
  'resources/list': { resources: [] },
  'resources/templates/list': { resourceTemplates: [] },
  'prompts/list': { prompts: [] },
};
const listConfigs = new Map<string, McpListConfig>();

app.put('/mcp-list/:key/config', (req, res) => {
  listConfigs.set(req.params.key, req.body ?? {});
  res.status(204).end();
});

app.post('/mcp-list/:key', (req, res) => {
  const { id, method, params } = req.body ?? {};
  // Notifications carry no id and expect no JSON-RPC response.
  if (id === undefined || method === undefined) {
    res.status(202).end();
    return;
  }
  if (method === 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        serverInfo: { name: 'mcp-list-mock', version: '1.0.0' },
      },
    });
    return;
  }
  if (method in EMPTY_LISTS) {
    const config = listConfigs.get(req.params.key);
    const script = config?.[method as McpListMethod];
    const reply: McpListReply =
      script === undefined
        ? { result: EMPTY_LISTS[method] }
        : 'pages' in script
          ? (script.pages[params?.cursor ?? ''] ?? { result: EMPTY_LISTS[method] })
          : script;
    if (method === 'tools/list' && config?.serverRequestReusingToolsListId) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id, ...reply })}\n\n`);
      res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id, method: 'roots/list' })}\n\n`);
      res.end();
      return;
    }
    res.json({ jsonrpc: '2.0', id, ...reply });
    return;
  }
  res.json({ jsonrpc: '2.0', id, error: { code: -32_601, message: 'Method not found' } });
});

app.get('/mcp-list/:key', (_req, res) => {
  res.writeHead(405).end();
});

const PORT = process.env.MCP_PORT || 4020;
const SECURE_PORT = process.env.MCP_SECURE_PORT || 4021;

app.listen(PORT, () => {
  process.stdout.write(`MCP mock server listening at http://localhost:${PORT}\n`);
});
https.createServer(HTTPS_OPTIONS, app).listen(SECURE_PORT, () => {
  process.stdout.write(`MCP mock server listening at https://localhost:${SECURE_PORT}\n`);
});
