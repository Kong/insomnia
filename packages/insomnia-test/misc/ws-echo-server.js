#!/usr/bin/env node
"use strict";

const { createServer } = require("node:http");
const { createServer: createHttpsServer } = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { WebSocketServer } = require("ws");

const PORT = process.env.WS_PORT || 4040;
const SECURE_PORT = process.env.WS_SECURE_PORT || 4041;

const HTTPS_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-cert.pem")),
};

function handleRequest(req, res) {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ws-echo-server ok");
}

function handleConnection(ws, req) {
  const delayMs = Number(req.headers["x-reply-delay-ms"]) || 0;

  const sendAfterDelay = (data, opts) => {
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) ws.send(data, opts);
    }, delayMs);
  };

  sendAfterDelay("Request served by insomnia-mock-ws-echo-server");

  ws.on("message", (data, isBinary) => {
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
