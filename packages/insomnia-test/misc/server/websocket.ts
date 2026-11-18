import fs from 'node:fs';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { Socket } from 'node:net';

import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import { certPath } from '../certs.ts';

/**
 * Starts an echo WebSocket server that receives messages from a client and echoes them back.
 */
export function startWebSocketServer(server: Server) {
  const wsServer = new WebSocketServer({ noServer: true, handleProtocols: () => 'chat' });

  server.on('upgrade', (request, socket, head) => {
    upgrade(wsServer, request, socket as any, head);
  });

  wsServer.on('connection', handleConnection);

  wsServer.on('headers', (headers, request) => {
    if (request.url === '/cookies') {
      headers.push('Set-Cookie: insomnia-websocket-test-cookie=foo');
    }
  });
}

const handleConnection = (ws: WebSocket, req: IncomingMessage) => {
  console.log('WebSocket connection was opened');
  console.log('Upgrade headers:', req.headers);

  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      ws.send(message);
      return;
    }

    // Returns binary data
    if (req.url === '/binary') {
      ws.send(Buffer.alloc(0));
      ws.send(Buffer.from('test'));
      ws.send(message);
      ws.send(message.toString());
      return;
    }

    if (message.toString() === 'close') {
      ws.close(1003, 'Invalid message type');
    }
    ws.send(message.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket connection was closed');
  });
};
const redirectOnSuccess = (socket: Socket) => {
  socket.end('HTTP/1.1 302 Found\r\nLocation: ws://localhost:4010/\r\n\r\n');
  return;
};
const return401withBody = (socket: Socket) => {
  socket.end(`HTTP/1.1 401 Unauthorized

  <!doctype html>
  <html>
  <body>
  <div>
    <h1>401 Unauthorized</h1>
  </div>
  </body>
  </html>`);
  return;
};
const upgrade = (wss: WebSocketServer, request: IncomingMessage, socket: Socket, head: Buffer) => {
  if (request.url === '/redirect') {
    return redirectOnSuccess(socket);
  }
  if (request.url === '/bearer') {
    if (request.headers.authorization !== 'Bearer insomnia-cool-token-!!!1112113243111') {
      return401withBody(socket);
      return;
    }
    return redirectOnSuccess(socket);
  }
  if (request.url === '/delay') {
    const delaySec = Number.parseInt((request.headers.duration as string) || '5');
    setTimeout(function () {
      redirectOnSuccess(socket);
    }, delaySec * 1000);
    return;
  }
  if (request.url === '/basic-auth') {
    // login with user:password
    if (request.headers.authorization !== `Basic ${Buffer.from('user:password').toString('base64')}`) {
      return401withBody(socket);
      return;
    }
    return redirectOnSuccess(socket);
  }
  if (request.url === '/chat/1234') {
    return redirectOnSuccess(socket);
  }
  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request);
  });
};

/**
 * Plain echo WebSocket servers the specs address by fixed port: every message
 * is echoed back (after `x-reply-delay-ms`, if sent), preceded by a greeting.
 *   4040  ws   4041  wss
 */
export function startWsEchoServers() {
  const handleRequest = (_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ws-echo-server ok');
  };

  const handleEchoConnection = (ws: WebSocket, req: IncomingMessage) => {
    const delayMs = Number(req.headers['x-reply-delay-ms']) || 0;
    const sendAfterDelay = (data: any, opts?: any) => {
      setTimeout(() => {
        if (ws.readyState === ws.OPEN) ws.send(data, opts);
      }, delayMs);
    };
    sendAfterDelay('Request served by insomnia-mock-ws-echo-server');
    ws.on('message', (data: any, isBinary: boolean) => {
      sendAfterDelay(data, { binary: isBinary });
    });
  };

  const httpServer = createServer(handleRequest);
  const httpsServer = createHttpsServer(
    { key: fs.readFileSync(certPath('localhost-key.pem')), cert: fs.readFileSync(certPath('localhost-cert.pem')) },
    handleRequest,
  );
  new WebSocketServer({ server: httpServer }).on('connection', handleEchoConnection);
  new WebSocketServer({ server: httpsServer }).on('connection', handleEchoConnection);

  httpServer.listen(4040, '127.0.0.1', () => console.log('ws echo server listening at ws://localhost:4040'));
  httpsServer.listen(4041, '127.0.0.1', () => console.log('ws echo server listening at wss://localhost:4041'));
}
