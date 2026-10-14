#!/usr/bin/env node
'use strict';

const http = require('node:http');

const PORT = 4090;

/** @type {Map<string, any>} key: `${METHOD} ${compoundId}` -> HAR response */
const bins = new Map();
/** @type {Map<string, any[]>} key: `${METHOD} ${compoundId}` -> HAR log entries */
const logs = new Map();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

// A fixed response a spec can send a request to and then turn into a mock
// route. It carries an explicit Content-Length (no chunked
// Transfer-Encoding): a route created from a response replays that
// response's headers as the *request* headers of its own "Test" request,
// and a chunked GET would never finish. Mirror any change here into
// `MOCK_BIN_SOURCE_RESPONSE` in constants.ts.
const SOURCE_RESPONSE_PATH = '/source';
const SOURCE_RESPONSE_STATUS = 202;
const SOURCE_RESPONSE_BODY = { source: 'mock-bin-server' };
const SOURCE_RESPONSE_HEADER_NAME = 'x-mock-source';
const SOURCE_RESPONSE_HEADER_VALUE = 'mock-bin-server';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'date',
  'keep-alive',
  'transfer-encoding',
]);

const readBody = req =>
  new Promise(resolve => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...CORS_HEADERS,
    ...headers,
  });
  res.end(body);
};

const handle = async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return send(res, 204, '');
  }

  if (url.pathname === '/health') {
    return send(res, 200, 'ok');
  }

  if (method === 'GET' && url.pathname === SOURCE_RESPONSE_PATH) {
    const body = JSON.stringify(SOURCE_RESPONSE_BODY);
    return send(res, SOURCE_RESPONSE_STATUS, body, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      [SOURCE_RESPONSE_HEADER_NAME]: SOURCE_RESPONSE_HEADER_VALUE,
    });
  }

  if (method === 'PUT' && url.pathname.startsWith('/bin/upsert/')) {
    const compoundId = decodeURIComponent(url.pathname.slice('/bin/upsert/'.length));
    const routeMethod = String(req.headers['insomnia-mock-method'] || 'GET').toUpperCase();
    bins.set(`${routeMethod} ${compoundId}`, JSON.parse((await readBody(req)) || '{}'));
    return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  }

  if (method === 'GET' && url.pathname.startsWith('/bin/log/')) {
    const compoundId = decodeURIComponent(url.pathname.slice('/bin/log/'.length));
    const routeMethod = String(req.headers['insomnia-mock-method'] || 'GET').toUpperCase();
    return send(
      res,
      200,
      JSON.stringify({
        log: {
          version: '1.2',
          creator: { name: 'mock-bin-server', version: '1.0.0' },
          entries: logs.get(`${routeMethod} ${compoundId}`) || [],
        },
      }),
      { 'Content-Type': 'application/json' },
    );
  }

  if (url.pathname.startsWith('/bin/')) {
    const compoundId = decodeURIComponent(url.pathname.slice('/bin/'.length));
    const key = `${method} ${compoundId}`;
    const body = await readBody(req);
    const entries = logs.get(key) || [];
    entries.push({
      startedDateTime: new Date().toISOString(),
      clientIPAddress: req.socket.remoteAddress || '',
      request: {
        method,
        url: `http://localhost:${PORT}${req.url}`,
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(req.headers).map(([name, value]) => ({ name, value: String(value) })),
        queryString: [...url.searchParams.entries()].map(([name, value]) => ({ name, value })),
        cookies: [],
        headersSize: -1,
        bodySize: Buffer.byteLength(body),
        postData: body ? { mimeType: String(req.headers['content-type'] || ''), text: body } : undefined,
      },
    });
    logs.set(key, entries);

    const har = bins.get(key);
    if (!har) {
      return send(res, 404, JSON.stringify({ error: 'no mock route for', key }), {
        'Content-Type': 'application/json',
      });
    }
    const headers = {};
    for (const { name, value } of har.headers || []) {
      if (name && !HOP_BY_HOP_HEADERS.has(name.toLowerCase())) headers[name] = value;
    }
    if (har.content?.mimeType && !Object.keys(headers).some(name => name.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = har.content.mimeType;
    }
    res.writeHead(har.status || 200, har.statusText || undefined, { ...CORS_HEADERS, ...headers });
    return res.end(har.content?.text || '');
  }

  if (method === 'DELETE' && url.pathname === '/_admin/reset') {
    bins.clear();
    logs.clear();
    return send(res, 200, 'ok');
  }

  return send(res, 404, 'not found');
};

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error('[mock-bin-server]', error);
    if (!res.headersSent) {
      send(res, 500, 'internal error');
    } else {
      res.end();
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-bin-server] listening on :${PORT}`);
});
