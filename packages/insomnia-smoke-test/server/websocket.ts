import { Server } from 'http';
import { WebSocketServer } from 'ws';

/**
 * Starts an echo WebSocket server that receives messages from a client and echoes them back.
 */
export function startWebsocketServer(server: Server) {
  const wsServer = new WebSocketServer({ server });

  wsServer.on('connection', ws => {
    console.log('WebSocket connection was opened');

    ws.on('message', (message, isBinary) => {
      if (isBinary) {
        ws.send(message);
        return;
      }

      ws.send(message.toString());
    });

    ws.on('close', () => {
      console.log('WebSocket connection was closed');
    });
  });

  return wsServer;
}
