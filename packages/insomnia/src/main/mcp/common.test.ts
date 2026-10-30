import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { services } from 'insomnia-data';
import { fetch as undiciFetch } from 'undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import { type ConnectionContext, getFetchDispatcher, writeEventLogAndNotify, writeTimeline } from './common';

const makeContext = (sensitiveValues: string[]) => {
  const timelineWrites: string[] = [];
  const eventLogWrites: string[] = [];
  const context = {
    requestId: 'req_mcp',
    // an empty responseId short-circuits the renderer notification inside the write callback
    responseId: '',
    pendingEventIds: [],
    sensitiveValues: new Set(sensitiveValues),
    timelineStream: { closed: false, write: (chunk: string) => timelineWrites.push(chunk) },
    eventLogStream: { writableEnded: false, write: (chunk: string) => eventLogWrites.push(chunk) },
  } as unknown as ConnectionContext;

  return { context, timelineWrites, eventLogWrites };
};

describe('MCP timeline and event-log redaction', () => {
  it('redacts the timeline value before serializing it', () => {
    const { context, timelineWrites } = makeContext(['s3cr3t']);

    writeTimeline(context, { value: 'With env: TOKEN=s3cr3t', name: 'Text', timestamp: 1 });

    expect(JSON.parse(timelineWrites[0])).toEqual({
      value: `With env: TOKEN=${CONFIDENTIAL_MASK_VALUE}`,
      name: 'Text',
      timestamp: 1,
    });
  });

  it('redacts nested event-log payloads before serializing, so values needing JSON escaping still match', () => {
    const secret = 'p@ss"with\\slash';
    const { context, eventLogWrites } = makeContext([secret]);

    writeEventLogAndNotify(context, {
      type: 'message',
      direction: 'OUTGOING',
      method: 'tools/call',
      data: { params: { arguments: { token: secret } } },
    });

    expect(JSON.parse(eventLogWrites[0]).data.params.arguments.token).toBe(CONFIDENTIAL_MASK_VALUE);
    expect(eventLogWrites[0]).not.toContain('p@ss');
  });

  it('leaves both streams untouched when nothing was collected (setting off)', () => {
    const { context, timelineWrites, eventLogWrites } = makeContext([]);

    writeTimeline(context, { value: 'TOKEN=s3cr3t', name: 'Text', timestamp: 1 });
    writeEventLogAndNotify(context, {
      type: 'message',
      direction: 'OUTGOING',
      method: 'tools/call',
      data: { token: 's3cr3t' },
    });

    expect(timelineWrites[0]).toContain('s3cr3t');
    expect(eventLogWrites[0]).toContain('s3cr3t');
  });
});

describe('getFetchDispatcher', () => {
  const tlsDir = path.join(__dirname, '__fixtures__', 'tls');
  const caPath = path.join(tlsDir, 'ca.pem');
  const selfSignedCertPath = path.join(tlsDir, 'self-signed.pem');
  const servers: https.Server[] = [];

  const startTlsServer = async (certFile: string, keyFile: string) => {
    const server = https.createServer(
      { key: fs.readFileSync(path.join(tlsDir, keyFile)), cert: fs.readFileSync(path.join(tlsDir, certFile)) },
      (_req, res) => res.end('secure-ok'),
    );
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, 'localhost', resolve));
    return `https://localhost:${(server.address() as AddressInfo).port}`;
  };

  // localhost.pem is signed by ca.pem; self-signed.pem is its own issuer. Both have SAN DNS:localhost
  let caSignedUrl: string;
  let selfSignedUrl: string;

  beforeAll(async () => {
    caSignedUrl = await startTlsServer('localhost.pem', 'localhost-key.pem');
    selfSignedUrl = await startTlsServer('self-signed.pem', 'self-signed-key.pem');
  });

  afterAll(async () => {
    await Promise.all(
      servers.map(async server => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }),
    );
  });

  const createMcpRequest = async ({
    sslValidation,
    caCertificate,
  }: {
    sslValidation?: boolean;
    caCertificate?: { path: string; disabled?: boolean };
  } = {}) => {
    const workspace = await services.workspace.create();
    if (caCertificate) {
      await services.caCertificate.create({ parentId: workspace._id, ...caCertificate });
    }
    return services.mcpRequest.create({
      parentId: workspace._id,
      ...(sslValidation === undefined ? {} : { sslValidation }),
    });
  };

  const fetchWithDispatcher = async (requestId: string, url = caSignedUrl) => {
    const dispatcher = await getFetchDispatcher(requestId);
    try {
      const response = await undiciFetch(url, { dispatcher });
      return await response.text();
    } finally {
      await dispatcher.close();
    }
  };

  it('rejects a server whose certificate is not trusted by default', async () => {
    const { _id } = await createMcpRequest();

    const error = await fetchWithDispatcher(_id).catch(e => e);

    expect(error).toBeInstanceOf(TypeError);
    expect(error.cause.code).toMatch(/UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|CERT_/);
  });

  it('trusts a server certificate signed by the custom CA of the workspace', async () => {
    const { _id } = await createMcpRequest({ caCertificate: { path: caPath } });

    await expect(fetchWithDispatcher(_id)).resolves.toBe('secure-ok');
  });

  it('rejects a self-signed server certificate by default', async () => {
    const { _id } = await createMcpRequest();

    const error = await fetchWithDispatcher(_id, selfSignedUrl).catch(e => e);

    expect(error.cause.code).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
  });

  it('trusts a self-signed server certificate that is configured as the workspace CA', async () => {
    const { _id } = await createMcpRequest({ caCertificate: { path: selfSignedCertPath } });

    await expect(fetchWithDispatcher(_id, selfSignedUrl)).resolves.toBe('secure-ok');
  });

  it('does not trust a self-signed certificate that is not the configured CA', async () => {
    const { _id } = await createMcpRequest({ caCertificate: { path: caPath } });

    await expect(fetchWithDispatcher(_id, selfSignedUrl)).rejects.toThrow('fetch failed');
  });

  it('ignores a disabled CA certificate', async () => {
    const { _id } = await createMcpRequest({ caCertificate: { path: caPath, disabled: true } });

    await expect(fetchWithDispatcher(_id)).rejects.toThrow('fetch failed');
  });

  it('accepts an untrusted certificate when SSL validation is turned off', async () => {
    const { _id } = await createMcpRequest({ sslValidation: false });

    await expect(fetchWithDispatcher(_id)).resolves.toBe('secure-ok');
    await expect(fetchWithDispatcher(_id, selfSignedUrl)).resolves.toBe('secure-ok');
  });

  it('still verifies the certificate when SSL validation is explicitly on', async () => {
    const { _id } = await createMcpRequest({ sslValidation: true });

    await expect(fetchWithDispatcher(_id)).rejects.toThrow('fetch failed');
  });

  it('throws when the MCP request does not exist', async () => {
    await expect(getFetchDispatcher('mcp-req_missing')).rejects.toThrow('McpRequest not found');
  });
});
