import { Server } from 'http';
import { WebSocketServer } from 'ws';

/**
 * Starts an echo WebSocket server that receives messages from a client and echoes them back.
 */
export function startWebsocketServer(server: Server) {
  const wsServer = new WebSocketServer({ server });

  wsServer.on('connection', (ws, req) => {
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
  });

  return wsServer;
}
