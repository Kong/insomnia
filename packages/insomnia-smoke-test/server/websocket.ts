import { IncomingMessage, Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

/**
 * Starts an echo WebSocket server that receives messages from a client and echoes them back.
 */
export function startWebSocketServer(server: Server, httpsServer: Server) {
  const wsServer = new WebSocketServer({ server });
  const wssServer = new WebSocketServer({ server: httpsServer });

  wsServer.on('connection', handleConnection);
  wssServer.on('connection', handleConnection);
}

const handleConnection = (ws: WebSocket, req: IncomingMessage) => {
  console.log('WebSocket connection was opened');
  console.log('Upgrade headers:', req.headers);

  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      ws.send(message);
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
