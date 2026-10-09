#!/usr/bin/env node
'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { certPath } = require('./certs');

const HTTPS_OPTIONS = {
  key: fs.readFileSync(certPath('localhost-key.pem')),
  cert: fs.readFileSync(certPath('localhost-cert.pem')),
};

const MIN_REPLY_DELAY_MS = 1;
const MAX_REPLY_DELAY_MS = 60_000;

function delayResponse(req) {
  const requestedDelayMs = Number(req.headers['x-reply-delay-ms']);
  if (!Number.isSafeInteger(requestedDelayMs)) return Promise.resolve();
  if (requestedDelayMs < MIN_REPLY_DELAY_MS || requestedDelayMs > MAX_REPLY_DELAY_MS) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, requestedDelayMs));
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `${req.socket.encrypted ? 'https' : 'http'}://localhost`);
  process.stdout.write(`${req.method} ${url.pathname}\n`);

  const sseEventsMatch = req.method === 'GET' && url.pathname.match(/^\/sse-events\/(\d+)$/);
  if (sseEventsMatch) {
    await delayResponse(req);
    const count = Number.parseInt(sseEventsMatch[1], 10);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ message: 'Starting Events', ts: Date.now() })}\n\n`);
    let sent = 0;
    const interval = setInterval(() => {
      sent++;
      res.write(`data: ${JSON.stringify({ message: 'Hello from the server!', ts: Date.now() })}\n\n`);
      if (sent >= count) {
        clearInterval(interval);
        res.end();
      }
    }, 1000);
    req.on('close', () => clearInterval(interval));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('{}');
}

const server = http.createServer(handleRequest);
const httpsServer = https.createServer(HTTPS_OPTIONS, handleRequest);

server.listen(4050, () => {
  process.stdout.write('Listening at http://localhost:4050\n');
});
httpsServer.listen(4051, () => {
  process.stdout.write('Listening at https://localhost:4051\n');
});
