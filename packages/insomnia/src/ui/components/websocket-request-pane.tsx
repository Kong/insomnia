import React, { FC } from 'react';

import { WebsocketActionBar } from './websockets/action-bar';

interface Props {
  requestId: string;
}
export const WebSocketRequestPane: FC<Props> = ({ requestId }) => {
  return (
    <div>
      <WebsocketActionBar requestId={requestId} />
    </div>
  );
};
