// import type { Server } from 'node:http';

import { createServer } from 'node:http';

import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

export function startSocketIOServer() {
  const app = express();
  const server = createServer(app);
  const io = new SocketIOServer(server);

  io.on('connection', socket => {
    console.log('socket.io connected:', socket.id);
    socket.on('message', (...args) => {
      console.log('socket.io server received data:', args);
      if (args[args.length - 1] instanceof Function) {
        const ackCallback = args.pop();
        ackCallback('ack from socket.io server', ...args);
      }
    });

    socket.on('disconnect', () => {
      console.log('socket.io disconnected');
    });
  });

  server.listen(4020, () => {
    console.log('Socket.IO server listening on port 4020');
  });
}
