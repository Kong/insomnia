import { WebSocketMessageEvent } from '../../../main/network/websocket';

export function rawEventData(event: WebSocketMessageEvent) {
  let raw = event.data.toString('utf-8');

  if (typeof event.data === 'object') {
    raw = JSON.stringify(event.data);
  }
  return raw;
}
