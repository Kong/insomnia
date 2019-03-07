// @flow

type WebSocketConfig = {
  origin?: string,
};

declare class WebSocket {
  constructor(url: string, config: WebSocketConfig): WebSocket;
  send(data: Buffer): void;

  on(event: 'message', callback: (data: Buffer) => void): void;
  on(event: 'open' | 'close', callback: () => void): void;
}

declare module 'ws' {
  declare module.exports: typeof WebSocket;
}
