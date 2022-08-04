import * as models from '../../../models';

interface UseWSControl {
  send: (message: string | Blob | ArrayBufferLike | ArrayBufferView) => void;
  connect: (url: string) => void;
  close: (code?: number, reason?: string) => void;
}

// TODO: replace the window.main.webSocketConnection.methods with client class or object
export function useWSControl(requestId: string): UseWSControl {
  const send = (message: string | Blob | ArrayBufferLike | ArrayBufferView) => {
    window.main.webSocketConnection.event.send({
      requestId,
      // TODO: handle types later
      message: JSON.stringify(message),
    });
  };

  const connect = async (url: string) => {
    const wsr = await models.websocketRequest.getById(requestId);
    if (wsr) {
      await models.websocketRequest.update(wsr, { url });
      await window.main.webSocketConnection.create({ requestId });
    }
  };

  const close = () => {
    window.main.webSocketConnection.close({ requestId });
  };

  return {
    send,
    connect,
    close,
  };
}
