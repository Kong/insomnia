import { useState } from 'react';

import { useWebSocketListener } from './use-websocket-listener';

export function useWSMessage(requestId: string): MessageEvent | null {
  const [message, setMessage] = useState<MessageEvent | null>(null);

  useWebSocketListener<MessageEvent>(message => {
    setMessage(message);
  }, 'websocket:message', requestId);

  return message;
}
