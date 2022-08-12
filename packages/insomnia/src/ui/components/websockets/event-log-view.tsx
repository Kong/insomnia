import React, { FC } from 'react';

import { WebsocketEvent } from '../../../main/network/websocket';
import { CodeEditor } from '../codemirror/code-editor';
interface Props {
  event: WebsocketEvent;
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
