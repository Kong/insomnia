import fs from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';

import { Server } from 'socket.io';

import { certPath } from '../certs.ts';

const AUTH_TOKEN = 'test-socket-io-token';

/**
 * Socket.IO echo server: every event is echoed back under the same name
 * (after `x-reply-delay-ms`, if sent). The `/protected` namespace only accepts
 * handshakes whose `auth.token` equals `AUTH_TOKEN` — mirror any change to the
 * token into SOCKET_SERVER_AUTH_TOKEN in misc/constants.ts.
 *   3000  http   3001  https
 */
export function startSocketIOServer() {
  const httpServer = createServer();
  const httpsServer = createHttpsServer({
    key: fs.readFileSync(certPath('localhost-key.pem')),
    cert: fs.readFileSync(certPath('localhost-cert.pem')),
  });
  const io = new Server(httpServer, { cors: { origin: '*' } });
  io.attach(httpsServer, { cors: { origin: '*' } });

  io.of('/protected').use((socket, next) => {
    if (socket.handshake.auth && socket.handshake.auth.token === AUTH_TOKEN) {
      next();
    } else {
      next(new Error('unauthorized'));
    }
  });
  io.of('/protected').on('connection', socket => {
    socket.onAny((event, ...args) => socket.emit(event, ...args));
  });

  io.on('connection', socket => {
    console.log(`socket.io client connected: ${socket.id}`);

    const delayMs = Number(socket.handshake.headers['x-reply-delay-ms']) || 0;

    socket.onAny((event, ...args) => {
      console.log(`socket.io received "${event}": ${JSON.stringify(args)}`);
      setTimeout(() => {
        if (socket.connected) socket.emit(event, ...args);
      }, delayMs);
    });

    socket.on('disconnect', reason => {
      console.log(`socket.io client disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(3000, '127.0.0.1', () => {
    console.log('Socket.IO server listening at http://localhost:3000');
  });
  httpsServer.listen(3001, '127.0.0.1', () => {
    console.log('Socket.IO server listening at https://localhost:3001');
  });
}
