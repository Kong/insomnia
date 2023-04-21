import { WebSocketEvent, WebSocketMessageEvent } from '../../../main/network/websocket';

export function printEventData(event: WebSocketMessageEvent) {
  let raw = event.data.toString('utf-8');

  if (typeof event.data === 'object') {
    raw = JSON.stringify(event.data);
  }
  return raw;
}

export function getEventType(event: WebSocketEvent) {
  if ('data' in event && typeof event.data === 'object') {
    return 'Binary';
  } else {
    return 'Text';
  }
}
