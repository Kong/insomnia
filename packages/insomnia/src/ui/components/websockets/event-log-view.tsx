import React, { FC } from 'react';

import { WebSocketEvent } from '../../../main/network/websocket';
import { CodeEditor } from '../codemirror/code-editor';
interface Props {
  event: WebSocketEvent;
}
export const EventLogView: FC<Props> = ({ event }) => {
  return (
    <CodeEditor
      hideLineNumbers
      mode={'text/plain'}
      defaultValue={JSON.stringify(event)}
      uniquenessKey={event._id}
      readOnly
    />
  );
};
