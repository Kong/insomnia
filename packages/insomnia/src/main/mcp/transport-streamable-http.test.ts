import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { services } from 'insomnia-data';
import { Agent, fetch as undiciFetch } from 'undici';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConnectionContext, writeEventLogAndNotify } from '~/main/mcp/common';
import { MCPAuthError, type McpOAuthClientProvider } from '~/main/mcp/oauth-client-provider';
import type { OpenMcpHTTPClientConnectionOptions } from '~/main/mcp/types';

import { createStreamableHTTPTransport } from './transport-streamable-http';

type WrappedFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

const sdk = vi.hoisted(() => ({ fetch: undefined as unknown as WrappedFetch }));

// Capture the `fetch` the transport hands to the MCP SDK, that is the wrappedFetch under test.
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(function (_url: URL, options: { fetch: WrappedFetch }) {
    sdk.fetch = options.fetch;
  }),
}));
vi.mock('@modelcontextprotocol/sdk/client/auth.js', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  auth: vi.fn(),
}));
// Wrap the real undici fetch so calls can be asserted while still going over the network.
vi.mock('undici', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, fetch: vi.fn(actual.fetch as typeof undiciFetch) };
});
// Keep the real getFetchDispatcher (CA + sslValidation handling) and silence the file/IPC writers.
vi.mock('~/main/mcp/common', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  writeTimeline: vi.fn(),
  writeEventLogAndNotify: vi.fn(),
}));

interface RecordedRequest {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const tlsDir = path.join(__dirname, '__fixtures__', 'tls');
const jsonRpcHeaders = () => new Headers({ 'content-type': 'application/json', 'accept': 'application/json' });
const toolsListBody = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

const listen = async (server: http.Server | https.Server) => {
  await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));
  return (server.address() as AddressInfo).port;
};
const close = async (server: http.Server | https.Server) => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
};

describe('createStreamableHTTPTransport fetch', () => {
  let server: http.Server;
  let baseUrl: string;
  let received: RecordedRequest[];
  let respond: (req: RecordedRequest, res: http.ServerResponse) => void;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const recorded = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        };
        received.push(recorded);
        respond(recorded, res);
      });
    });
    baseUrl = `http://localhost:${await listen(server)}`;
  });

  afterAll(() => close(server));

  beforeEach(() => {
    received = [];
    respond = (_req, res) => res.end('ok');
    vi.mocked(auth).mockReset();
    vi.mocked(undiciFetch).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMcpRequest = async (caCertificatePath?: string) => {
    const workspace = await services.workspace.create();
    if (caCertificatePath) {
      await services.caCertificate.create({ parentId: workspace._id, path: caCertificatePath });
    }
    return services.mcpRequest.create({ parentId: workspace._id });
  };

  const setup = async ({
    authentication = {},
    tokens = [],
    caCertificatePath,
  }: {
    authentication?: Record<string, unknown>;
    tokens?: { access_token: string }[];
    caCertificatePath?: string;
  } = {}) => {
    const { _id: requestId } = await createMcpRequest(caCertificatePath);
    const context = {
      requestId,
      responseId: 'res_1',
      environmentId: null,
      timelinePath: '',
      eventLogPath: '',
      sensitiveValues: new Set<string>(),
      options: { authentication },
    } as unknown as ConnectionContext;
    // Hand out the queued tokens one by one, then keep the last one.
    const queue = [...tokens];
    let current: { access_token: string } | undefined;
    const authProvider = {
      tokens: vi.fn(async () => current),
      saveResourceMetadataUrl: vi.fn(),
      onRedirectEnd: vi.fn(() => vi.fn()),
    } as unknown as McpOAuthClientProvider;
    const nextToken = () => {
      current = queue.shift() ?? current;
    };
    await createStreamableHTTPTransport(
      context,
      { url: `${baseUrl}/mcp`, headers: [] } as unknown as OpenMcpHTTPClientConnectionOptions,
      authProvider,
    );
    return { context, authProvider, nextToken, fetch: sdk.fetch };
  };

  describe('fetch implementation', () => {
    it("uses undici's fetch with a dispatcher instead of the global fetch", async () => {
      const globalFetch = vi.spyOn(globalThis, 'fetch');
      const { fetch } = await setup();

      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: jsonRpcHeaders(),
        body: toolsListBody,
      });

      expect(response.status).toBe(200);
      expect(undiciFetch).toHaveBeenCalledTimes(1);
      expect(undiciFetch).toHaveBeenCalledWith(
        `${baseUrl}/mcp`,
        expect.objectContaining({ dispatcher: expect.any(Agent) }),
      );
      expect(globalFetch).not.toHaveBeenCalled();
    });

    it('accepts the Headers, string body and signal created by the global (built-in) undici', async () => {
      const { fetch } = await setup();
      const headers = jsonRpcHeaders();
      headers.set('mcp-session-id', 'session-1');
      const controller = new AbortController();

      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: toolsListBody,
        signal: controller.signal,
      });

      expect(await response.text()).toBe('ok');
      expect(received).toHaveLength(1);
      expect(received[0].headers['mcp-session-id']).toBe('session-1');
      expect(received[0].headers['content-type']).toBe('application/json');
      expect(received[0].body).toBe(toolsListBody);
    });

    it('rejects with an AbortError when the signal is aborted', async () => {
      respond = () => {}; // never answer
      const { fetch } = await setup();
      const controller = new AbortController();

      const pending = fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: jsonRpcHeaders(),
        body: toolsListBody,
        signal: controller.signal,
      });
      await vi.waitFor(() => expect(received).toHaveLength(1));
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('streams a server-sent events body through the response', async () => {
      respond = (_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n');
      };
      const { fetch } = await setup();

      const response = await fetch(`${baseUrl}/mcp`, { headers: new Headers({ accept: 'text/event-stream' }) });

      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(await response.text()).toContain('data: {"jsonrpc":"2.0","id":1,"result":{}}');
    });
  });

  describe('401 handling', () => {
    const mcpOAuth = { type: 'oauth2', grantType: 'mcp_auth_flow' };
    const metadataUrl = () => `${baseUrl}/.well-known/oauth-protected-resource`;

    // 401 until a Bearer token is sent, then 200
    const requireBearerToken = () => {
      respond = (req, res) => {
        if (req.url?.startsWith('/.well-known')) {
          res.end('{}');
        } else if (req.headers.authorization) {
          res.end('authorized');
        } else {
          res.writeHead(401, { 'www-authenticate': `Bearer resource_metadata="${metadataUrl()}", scope="read"` });
          res.end();
        }
      };
    };

    it('runs the auth flow with undici fetch and retries the request with the new token', async () => {
      requireBearerToken();
      const { fetch, nextToken } = await setup({
        authentication: mcpOAuth,
        tokens: [{ access_token: 'new-token' }],
      });
      vi.mocked(auth).mockImplementation(async (_provider, options) => {
        // the SDK discovers the authorization server through the fetchFn we hand it
        await options.fetchFn!(metadataUrl());
        nextToken();
        return 'AUTHORIZED';
      });

      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: jsonRpcHeaders(),
        body: toolsListBody,
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('authorized');
      expect(received.map(r => [r.method, r.url, r.headers.authorization])).toEqual([
        ['POST', '/mcp', undefined],
        ['GET', '/.well-known/oauth-protected-resource', undefined],
        ['POST', '/mcp', 'Bearer new-token'],
      ]);
      expect(received[2].body).toBe(toolsListBody);
      expect(auth).toHaveBeenCalledTimes(1);
      expect(vi.mocked(auth).mock.calls[0][1]).toMatchObject({
        serverUrl: `${baseUrl}/mcp`,
        scope: 'read',
        resourceMetadataUrl: new URL(metadataUrl()),
      });
      // original request + auth discovery + retry, all through undici's fetch
      expect(undiciFetch).toHaveBeenCalledTimes(3);
      for (const [, init] of vi.mocked(undiciFetch).mock.calls) {
        expect(init).toMatchObject({ dispatcher: expect.any(Agent) });
      }
      expect(writeEventLogAndNotify).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'MCP Auth', direction: 'OUTGOING' }),
      );
    });

    it('only retries once when the retried request is still unauthorized', async () => {
      respond = (_req, res) => {
        res.writeHead(401);
        res.end();
      };
      const { fetch } = await setup({ authentication: mcpOAuth });
      vi.mocked(auth).mockResolvedValue('AUTHORIZED');

      const response = await fetch(`${baseUrl}/mcp`, { method: 'POST', body: toolsListBody });

      expect(response.status).toBe(401);
      expect(auth).toHaveBeenCalledTimes(1);
      expect(received).toHaveLength(2);
    });

    it('wraps a failing auth flow in an MCPAuthError', async () => {
      requireBearerToken();
      const { fetch } = await setup({ authentication: mcpOAuth });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(auth).mockRejectedValue(new Error('registration failed'));

      await expect(fetch(`${baseUrl}/mcp`, { method: 'POST', body: toolsListBody })).rejects.toThrow(MCPAuthError);
      expect(received).toHaveLength(1);
    });

    it('does not start the auth flow when the request does not use MCP OAuth', async () => {
      requireBearerToken();
      const { fetch } = await setup({ authentication: { type: 'basic', username: 'u', password: 'p' } });

      const response = await fetch(`${baseUrl}/mcp`, { method: 'POST', body: toolsListBody });

      expect(response.status).toBe(401);
      expect(auth).not.toHaveBeenCalled();
    });

    it('does not start the auth flow for DELETE requests', async () => {
      requireBearerToken();
      const { fetch } = await setup({ authentication: mcpOAuth });

      const response = await fetch(`${baseUrl}/mcp`, { method: 'DELETE' });

      expect(response.status).toBe(401);
      expect(auth).not.toHaveBeenCalled();
    });
  });

  describe('TLS', () => {
    let tlsServer: https.Server;
    let tlsUrl: string;

    beforeAll(async () => {
      tlsServer = https.createServer(
        {
          key: fs.readFileSync(path.join(tlsDir, 'localhost-key.pem')),
          cert: fs.readFileSync(path.join(tlsDir, 'localhost.pem')),
        },
        (_req, res) => res.end('secure-ok'),
      );
      tlsUrl = `https://localhost:${await listen(tlsServer)}/mcp`;
    });

    afterAll(() => close(tlsServer));

    it('connects to a server signed by the custom CA configured on the workspace', async () => {
      const { fetch } = await setup({ caCertificatePath: path.join(tlsDir, 'ca.pem') });

      const response = await fetch(tlsUrl, { method: 'POST', headers: jsonRpcHeaders(), body: toolsListBody });

      expect(await response.text()).toBe('secure-ok');
    });

    it('fails to connect to the same server without the custom CA', async () => {
      const { fetch } = await setup();

      await expect(fetch(tlsUrl, { method: 'POST', headers: jsonRpcHeaders(), body: toolsListBody })).rejects.toThrow(
        'fetch failed',
      );
    });
  });
});
