#!/usr/bin/env node
"use strict";

const { createServer } = require("node:http");
const { createServer: createHttpsServer } = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { Server } = require("socket.io");

const PORT = process.env.SOCKET_PORT || 3000;
const SECURE_PORT = process.env.SOCKET_SECURE_PORT || 3001;

const HTTPS_OPTIONS = {
  key: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-cert.pem")),
};

const httpServer = createServer();
const httpsServer = createHttpsServer(HTTPS_OPTIONS);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});
io.attach(httpsServer, { cors: { origin: "*" } });

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

httpServer.listen(PORT, () => {
  process.stdout.write(
    `Socket.IO server listening at http://localhost:${PORT}\n`,
  );
});
httpsServer.listen(SECURE_PORT, () => {
  process.stdout.write(
    `Socket.IO server listening at https://localhost:${SECURE_PORT}\n`,
  );
});
