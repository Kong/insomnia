import EventEmitter from 'events';

class FakeIPCWebSocketAPI {
  // this needs to actually use from ws package instead of node
  private _instanceMap =  new Map<string, WebSocket>();

  // this is not necessary when using WebSocket from 'ws' since it has status. This is used to just mimic the library
  public eventEmitter$ =  new EventEmitter();

  public openWebsocket(uri: string, requestId: string): void {
    if (this._instanceMap.has(requestId)) {
      throw new Error('websocket connection already exists');
    }

    const ws = new WebSocket(uri);
    this.eventEmitter$.emit('websocket:status', requestId, ws.readyState);

    ws.onopen = () => {
      this.eventEmitter$.emit('websocket:status', requestId, ws.readyState);
    };

    ws.onmessage = (message: MessageEvent) => {
      this.eventEmitter$.emit('websocket:message', requestId, message);
    };

    ws.onclose = () => {
      this._instanceMap.delete(requestId);
      this.eventEmitter$.emit('websocket:status', requestId, ws.readyState);
    };

    ws.onerror = (event: Event) => {
      // do something else
      this.eventEmitter$.emit('websocket:error', requestId, event);
    };

    this._instanceMap.set(requestId, ws);
  }

  public messageWebsocket({ message, requestId }: { message: string | ArrayBufferLike | Blob | ArrayBufferView; requestId: string }): void {
    if (!this._instanceMap.has(requestId)) {
      throw new Error('no connection is there');
    }

    const ws = this._instanceMap.get(requestId);

    if (!ws) {
      throw new Error('no ws is instantiated');
    }

    ws.send(message);
  }

  public closeWebsocket(requestId: string, code?: number, reason?: string): void {
    if (!this._instanceMap.has(requestId)) {
      //   throw new Error('no connection is there');
    }

    const ws = this._instanceMap.get(requestId);
    if (!ws) {
      //   throw new Error('no ws is instantiated');
    }

    ws?.close(code, reason);
  }
}

export const FakeWebSocketAPI = Object.freeze(new FakeIPCWebSocketAPI());
