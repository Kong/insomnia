#!/usr/bin/env node

import fs from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";

import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import { certPath } from "./certs";

const PORT = process.env.WS_PORT || 4040;
const SECURE_PORT = process.env.WS_SECURE_PORT || 4041;

const HTTPS_OPTIONS = {
  key: fs.readFileSync(certPath("localhost-key.pem")),
  cert: fs.readFileSync(certPath("localhost-cert.pem")),
};

function handleRequest(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ws-echo-server ok");
}

function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const delayMs = Number(req.headers["x-reply-delay-ms"]) || 0;

  const sendAfterDelay = (data: WebSocket.RawData | string, opts?: { binary: boolean }) => {
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) ws.send(data, opts ?? {});
    }, delayMs);
  };

  sendAfterDelay("Request served by insomnia-mock-ws-echo-server");

  ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
    sendAfterDelay(data, { binary: isBinary });
  });
}

const httpServer = createServer(handleRequest);
const httpsServer = createHttpsServer(HTTPS_OPTIONS, handleRequest);

const wss = new WebSocketServer({ server: httpServer });
wss.on("connection", handleConnection);

const wssSecure = new WebSocketServer({ server: httpsServer });
wssSecure.on("connection", handleConnection);

httpServer.listen(PORT, () => {
  process.stdout.write(
    `WebSocket echo server listening at http://localhost:${PORT}\n`,
  );
});
httpsServer.listen(SECURE_PORT, () => {
  process.stdout.write(
    `WebSocket echo server listening at https://localhost:${SECURE_PORT}\n`,
  );
});
