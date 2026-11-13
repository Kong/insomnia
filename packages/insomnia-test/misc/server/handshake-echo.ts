import { createServer } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';

/**
 * Servers that report what a client's connection handshake carried, for
 * checking which headers and auth Insomnia attached to a connection.
 *   4140  WebSocket    — sends `{ headers }` as its first message
 *   4141  Socket.IO    — emits a `handshake` event with `{ headers, auth }` and keeps the latest
 *                        one, served as JSON from `GET /last-handshake` (the Socket.IO request pane
 *                        only shows events it has listeners for)
 * Mirror any port change into WS_HANDSHAKE_SERVER / SOCKET_IO_HANDSHAKE_SERVER
 * in misc/constants.ts.
 */
export function startHandshakeEchoServers() {
  const wsHttpServer = createServer();
  new WebSocketServer({ server: wsHttpServer }).on('connection', (ws, request) => {
    ws.send(JSON.stringify({ headers: request.headers }));
  });
  wsHttpServer.listen(4140, '127.0.0.1', () => console.log('WebSocket handshake echo listening at ws://localhost:4140'));

  let lastSocketIoHandshake: unknown = null;
  const socketIoHttpServer = createServer((request, response) => {
    // Requests outside Socket.IO's own path fall through to this handler.
    if (request.url?.startsWith('/last-handshake')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(lastSocketIoHandshake));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  const io = new SocketIOServer(socketIoHttpServer, { cors: { origin: '*' } });
  io.on('connection', socket => {
    lastSocketIoHandshake = { headers: socket.handshake.headers, auth: socket.handshake.auth };
    socket.emit('handshake', lastSocketIoHandshake);
  });
  socketIoHttpServer.listen(4141, '127.0.0.1', () =>
    console.log('Socket.IO handshake echo listening at ws://localhost:4141'),
  );
}
