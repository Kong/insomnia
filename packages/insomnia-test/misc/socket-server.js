#!/usr/bin/env node
"use strict";

const { createServer } = require("node:http");
const { createServer: createHttpsServer } = require("node:https");
const fs = require("node:fs");
const { Server } = require("socket.io");
const { certPath } = require("./certs");

const PORT = process.env.SOCKET_PORT || 3000;
const SECURE_PORT = process.env.SOCKET_SECURE_PORT || 3001;

const HTTPS_OPTIONS = {
  key: fs.readFileSync(certPath("localhost-key.pem")),
  cert: fs.readFileSync(certPath("localhost-cert.pem")),
};

const httpServer = createServer();
const httpsServer = createHttpsServer(HTTPS_OPTIONS);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});
io.attach(httpsServer, { cors: { origin: "*" } });

const AUTH_TOKEN = "test-socket-io-token";
io.of("/protected").use((socket, next) => {
  if (socket.handshake.auth && socket.handshake.auth.token === AUTH_TOKEN) {
    next();
  } else {
    next(new Error("unauthorized"));
  }
});
io.of("/protected").on("connection", (socket) => {
  socket.onAny((event, ...args) => socket.emit(event, ...args));
});

io.on("connection", (socket) => {
  process.stdout.write(`client connected: ${socket.id}\n`);

  const delayMs = Number(socket.handshake.headers["x-reply-delay-ms"]) || 0;

  socket.onAny((event, ...args) => {
    process.stdout.write(`received "${event}": ${JSON.stringify(args)}\n`);
    setTimeout(() => {
      if (socket.connected) socket.emit(event, ...args);
    }, delayMs);
  });

  socket.on("disconnect", (reason) => {
    process.stdout.write(`client disconnected: ${socket.id} (${reason})\n`);
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(
    `Socket.IO server listening at http://localhost:${PORT}\n`,
  );
});
httpsServer.listen(SECURE_PORT, '127.0.0.1', () => {
  process.stdout.write(
    `Socket.IO server listening at https://localhost:${SECURE_PORT}\n`,
  );
});
