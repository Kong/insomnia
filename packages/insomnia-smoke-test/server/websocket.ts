import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

/**
 * Starts an echo WebSocket server that receives messages from a client and echoes them back.
 */
export function startWebsocketServer(server: Server) {
  const wsServer = new WebSocketServer({ server: server });

  wsServer.on('connection', (ws: WebSocket) => {
    console.log('WebSocket connection was opened');

    ws.on('message', (message: string) => {
      ws.send(message);
    });

    ws.on('close', () => {
      console.log('WebSocket connection was closed');
    });
  });

  return wsServer;
}
