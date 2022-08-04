import React, { FunctionComponent } from 'react';

import { WebsocketActionBar } from './websockets/action-bar';

interface Props {
  requestId: string;
}
export const WebSocketRequestPane: FunctionComponent<Props> = ({ requestId }) => {
  return (
    <div>
      <WebsocketActionBar requestId={requestId} />
    </div>
  );
};
