export interface WebSocketClient {
    create: typeof window.main.webSocketConnection.create;
    close: typeof window.main.webSocketConnection.close;
    send: typeof window.main.webSocketConnection.event.send;
    onReadyState: typeof window.main.webSocketConnection.readyState.subscribe;
    getReadyState: typeof window.main.webSocketConnection.readyState.getCurrent;
  }
export function createWebSocketClient(): WebSocketClient {
  return {
    create: window.main.webSocketConnection.create,
    close: window.main.webSocketConnection.close,
    send: window.main.webSocketConnection.event.send,
    onReadyState: window.main.webSocketConnection.readyState.subscribe,
    getReadyState: window.main.webSocketConnection.readyState.getCurrent,
  };
}
