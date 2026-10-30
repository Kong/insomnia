#!/usr/bin/env node

import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";

import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

import { certPath } from "./certs.ts";

const PORT = process.env.WS_PORT || 4040;
const SECURE_PORT = process.env.WS_SECURE_PORT || 4041;

const HTTPS_OPTIONS = {
  key: fs.readFileSync(certPath("localhost-key.pem")),
  cert: fs.readFileSync(certPath("localhost-cert.pem")),
};

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ws-echo-server ok");
}

function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const delayMs = Number(req.headers["x-reply-delay-ms"]) || 0;

  const sendAfterDelay = (data: any, opts?: any) => {
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) ws.send(data, opts);
    }, delayMs);
  };

  sendAfterDelay("Request served by insomnia-mock-ws-echo-server");

  ws.on("message", (data: any, isBinary: boolean) => {
    sendAfterDelay(data, { binary: isBinary });
  });
}

const httpServer = createServer(handleRequest);
const httpsServer = createHttpsServer(HTTPS_OPTIONS, handleRequest);

const wss = new WebSocketServer({ server: httpServer });
wss.on("connection", handleConnection);

const wssSecure = new WebSocketServer({ server: httpsServer });
wssSecure.on("connection", handleConnection);

httpServer.listen(PORT as number, '127.0.0.1', () => {
  process.stdout.write(
    `WebSocket echo server listening at http://localhost:${PORT}\n`,
  );
});
httpsServer.listen(SECURE_PORT as number, '127.0.0.1', () => {
  process.stdout.write(
    `WebSocket echo server listening at https://localhost:${SECURE_PORT}\n`,
  );
});
