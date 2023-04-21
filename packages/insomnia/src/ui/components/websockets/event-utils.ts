import { WebSocketEvent, WebSocketMessageEvent } from '../../../main/network/websocket';

export function printEventData(event: WebSocketMessageEvent) {
  let raw = event.data.toString('utf-8');

  if (typeof event.data === 'object') {
    raw = JSON.stringify(event.data);
  }

  // Best effort to parse the binary data as a string
  try {
    if ('data' in event && typeof event.data === 'object' && 'data' in event.data && Array.isArray(event.data.data)) {
      raw = Buffer.from(event.data.data).toString('utf-8');
    }
  } catch (err) {
    // Ignore
    console.error('Failed to parse event data to string, defaulting to JSON.stringify', err);
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
