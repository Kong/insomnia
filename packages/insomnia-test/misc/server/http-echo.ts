// httpbin-style HTTP/HTTPS echo used by the request specs. It runs as its own
// express app (not the main one) because specs and fixture collections address
// it by fixed ports and expect these exact response shapes:
//   4060  http (127.0.0.1 and [::1])
//   4061  https, self-signed localhost cert
//   4062  https, certificate signed by the custom CA (no client cert asked)
//   4063  https, mTLS — a client cert signed by the CA is required
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

import bodyParser from 'body-parser';
import express from 'express';
import { buildSchema, graphql } from 'graphql';

import { certPath } from '../certs.ts';

const PETSTORE_SWAGGER = fs.readFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'petstore-swagger.json'), 'utf8');

const GRAPHQL_SCHEMA = buildSchema(`
  """A character from the show."""
  type Character {
    """The character's given name."""
    name: String!
    """Whether the character is alive or dead."""
    status: String!
  }

  """A page of character search results."""
  type CharacterResults {
    results: [Character!]!
  }

  """A single episode."""
  type Episode {
    id: Int!
    name: String!
  }

  input CharacterFilter {
    status: String
  }

  type Query {
    """Search characters, optionally filtered by status."""
    characters(filter: CharacterFilter): CharacterResults!
    """Look up a single episode by its numeric id."""
    episode(id: Int!): Episode
  }
`);

const GRAPHQL_CHARACTERS = [
  { name: 'Rick Sanchez', status: 'Alive' },
  { name: 'Morty Smith', status: 'Alive' },
  { name: 'Summer Smith', status: 'Dead' },
];

const GRAPHQL_EPISODES = [
  { id: 1, name: 'Pilot' },
  { id: 2, name: 'Lawnmower Dog' },
  { id: 3, name: 'Anatomy Park' },
];

const GRAPHQL_ROOT = {
  characters: ({ filter }: { filter?: { status?: string } }) => ({
    results: filter?.status ? GRAPHQL_CHARACTERS.filter(c => c.status === filter.status) : GRAPHQL_CHARACTERS,
  }),
  episode: ({ id }: { id: number }) => GRAPHQL_EPISODES.find(e => e.id === id) ?? null,
};

const MIN_REPLY_DELAY_MS = 1;
const MAX_REPLY_DELAY_MS = 60_000;

function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
}

function queryArgs(search: string) {
  const args: Record<string, any> = {};
  for (const [k, v] of new URLSearchParams(search)) {
    if (args[k] === undefined) {
      args[k] = v;
    } else if (Array.isArray(args[k])) {
      args[k].push(v);
    } else {
      args[k] = [args[k], v];
    }
  }
  return args;
}

const app = express();
// `type: () => true` (not '*/*'): requests without a Content-Type header, e.g. the
// scripts' sendRequest() with a string body, must still have their body read.
const rawBody = bodyParser.raw({ inflate: true, type: () => true });

app.use((req, res, next) => {
  process.stdout.write(`[http-echo] ${req.method} ${req.path}\n`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  const requestedDelayMs = Number(req.headers['x-reply-delay-ms']);
  if (Number.isSafeInteger(requestedDelayMs) && requestedDelayMs >= MIN_REPLY_DELAY_MS && requestedDelayMs <= MAX_REPLY_DELAY_MS) {
    setTimeout(next, requestedDelayMs);
    return;
  }
  next();
});

app.options('*', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(204).end();
});

app.get('/cookies', (req, res) => {
  res.status(200).json({ cookies: parseCookies(req.headers.cookie) });
});

app.all('/post', rawBody, (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'QUERY') {
    next();
    return;
  }
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  const [, search = ''] = req.originalUrl.split('?');
  res.status(200).json({
    args: queryArgs(search),
    data: raw,
    files: {},
    form: {},
    headers: req.headers,
    json,
    origin: req.socket.remoteAddress || '127.0.0.1',
    url: `${req.protocol}://localhost${req.originalUrl}`,
  });
});

app.post('/posts', rawBody, (req, res) => {
  let parsed = {};
  try {
    parsed = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '');
  } catch {}
  // writeHead + end (not res.json/send, which re-case the header to `Content-Type`):
  // the lowercase name matches the previous raw-http echo, and specs assert it.
  res.writeHead(201, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ...parsed, id: 101 }));
});

app.post('/graphql', rawBody, async (req, res) => {
  let query = '';
  let variables;
  let operationName;
  try {
    ({ query = '', variables, operationName } = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''));
  } catch {}
  const result = await graphql({
    schema: GRAPHQL_SCHEMA,
    source: query,
    rootValue: GRAPHQL_ROOT,
    variableValues: variables,
    operationName,
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(result));
});

app.get('/v2/swagger.json', (_req, res) => {
  res.status(200).type('application/json').send(PETSTORE_SWAGGER);
});

app.get(/^\/v2\/pet\/\d+$/, (req, res) => {
  const petId = Number(req.path.split('/').pop());
  res.status(200).json({
    id: petId,
    category: { id: 1, name: 'dogs' },
    name: 'doggie',
    photoUrls: ['https://example.com/doggie.jpg'],
    tags: [{ id: 1, name: 'friendly' }],
    status: 'available',
    cookies: parseCookies(req.headers.cookie),
  });
});

app.post('/calculator.asmx', rawBody, (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const intA = Number.parseInt((raw.match(/<[\w:]*intA>(-?\d+)</) || [])[1], 10) || 0;
  const intB = Number.parseInt((raw.match(/<[\w:]*intB>(-?\d+)</) || [])[1], 10) || 0;
  res
    .status(200)
    .type('text/xml; charset=utf-8')
    .send(
      `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
        `<soap:Body><AddResponse xmlns="http://tempuri.org/">` +
        // intA/intB are parsed integers, so the sum is always numeric and cannot inject markup.
        // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format
        `<AddResult>${intA + intB}</AddResult>` +
        `</AddResponse></soap:Body></soap:Envelope>`,
    );
});

app.get('/large-json', (_req, res) => {
  const items = Array.from({ length: 100_000 }, (_, i) => ({ id: i, name: `item-${i}`, value: 'x'.repeat(100) }));
  res.status(200).json({ items });
});

app.get('/status/404', (_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Anything else: a harmless 200 `{}`.
app.use((_req, res) => {
  res.status(200).json({});
});

export function startHttpEchoServers() {
  const mtlsCa = fs.readFileSync(certPath('mtls-ca.pem'));
  const caSignedServer = {
    key: fs.readFileSync(certPath('mtls-server-key.pem')),
    cert: fs.readFileSync(certPath('mtls-server-cert.pem')),
  };

  http.createServer(app).listen(4060, '127.0.0.1', () => {
    console.log('http-echo listening at http://localhost:4060');
  });
  // Loopback-only IPv6 listener so http://[::1]:4060 (ipv6-local-address.spec.ts) is reachable too.
  http.createServer(app).listen(4060, '::1');
  https
    .createServer(
      { key: fs.readFileSync(certPath('localhost-key.pem')), cert: fs.readFileSync(certPath('localhost-cert.pem')) },
      app,
    )
    .listen(4061, '127.0.0.1', () => console.log('http-echo listening at https://localhost:4061'));
  https
    .createServer(caSignedServer, app)
    .listen(4062, '127.0.0.1', () => console.log('http-echo listening at https://localhost:4062 (custom CA)'));
  https
    .createServer({ ...caSignedServer, ca: [mtlsCa], requestCert: true, rejectUnauthorized: true }, app)
    .listen(4063, '127.0.0.1', () => console.log('http-echo listening at https://localhost:4063 (mTLS)'));
}
