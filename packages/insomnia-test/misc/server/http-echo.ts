// httpbin-style HTTP/HTTPS echo used by the request specs. It is an express
// router, not a server: the main mock server (index.ts) mounts it on
//   4010  http                 /http-echo
//   4011  https, custom CA     /http-echo       (no client cert asked)
//   4011  https, mTLS          /http-echo-mtls  (a client cert signed by the CA is required, else 401)
// and `startHttpEchoSelfSignedServer` serves the same router on
//   4061  https, self-signed localhost cert  /http-echo
// Mirror any change to the paths/ports into HTTP_SERVER* in constants.ts.
import fs from 'node:fs';
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

export const httpEchoRouter = express.Router();
// `type: () => true` (not '*/*'): requests without a Content-Type header, e.g. the
// scripts' sendRequest() with a string body, must still have their body read.
const rawBody = bodyParser.raw({ inflate: true, type: () => true });

httpEchoRouter.use((req, res, next) => {
  process.stdout.write(`[http-echo] ${req.method} ${req.path}\n`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  const requestedDelayMs = Number(req.headers['x-reply-delay-ms']);
  if (Number.isSafeInteger(requestedDelayMs) && requestedDelayMs >= MIN_REPLY_DELAY_MS && requestedDelayMs <= MAX_REPLY_DELAY_MS) {
    setTimeout(next, requestedDelayMs);
    return;
  }
  next();
});

httpEchoRouter.options('*', (_req, res) => {
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(204).end();
});

httpEchoRouter.get('/cookies', (req, res) => {
  res.status(200).json({ cookies: parseCookies(req.headers.cookie) });
});

httpEchoRouter.all('/post', rawBody, (req, res, next) => {
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

httpEchoRouter.post('/posts', rawBody, (req, res) => {
  let parsed = {};
  try {
    parsed = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '');
  } catch {}
  // writeHead + end (not res.json/send, which re-case the header to `Content-Type`):
  // the lowercase name matches the previous raw-http echo, and specs assert it.
  res.writeHead(201, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ...parsed, id: 101 }));
});

httpEchoRouter.post('/graphql', rawBody, async (req, res) => {
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

httpEchoRouter.get('/v2/swagger.json', (_req, res) => {
  res.status(200).type('application/json').send(PETSTORE_SWAGGER);
});

httpEchoRouter.get(/^\/v2\/pet\/\d+$/, (req, res) => {
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

httpEchoRouter.post('/calculator.asmx', rawBody, (req, res) => {
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
        `<AddResult>${intA + intB}</AddResult>` +
        `</AddResponse></soap:Body></soap:Envelope>`,
    );
});

httpEchoRouter.get('/large-json', (_req, res) => {
  const items = Array.from({ length: 100_000 }, (_, i) => ({ id: i, name: `item-${i}`, value: 'x'.repeat(100) }));
  res.status(200).json({ items });
});

httpEchoRouter.get('/status/404', (_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Anything else: a harmless 200 `{}`.
httpEchoRouter.use((_req, res) => {
  res.status(200).json({});
});

export function startHttpEchoSelfSignedServer() {
  const app = express();
  app.use('/http-echo', httpEchoRouter);
  https
    .createServer(
      { key: fs.readFileSync(certPath('localhost-key.pem')), cert: fs.readFileSync(certPath('localhost-cert.pem')) },
      app,
    )
    .listen(4061, '127.0.0.1', () => console.log('http-echo listening at https://localhost:4061/http-echo'));
}
