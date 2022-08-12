import React, { FC } from 'react';
import styled from 'styled-components';

import { WebsocketEvent } from '../../../main/network/websocket';
import { CodeEditor } from '../codemirror/code-editor';

const EditorWrapper = styled.form({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
});

interface Props {
  event: WebsocketEvent;
}
export const EventLogView: FC<Props> = ({ event }) => {
  return (
    <div style={{ flex: 1, borderTop: '1px solid var(--hl-md)' }}>
      <EditorWrapper id="websocketMessageForm">
        <div style={{ height: '100%', padding: 10 }}>
          <CodeEditor
            hideLineNumbers
            mode={'text/plain'}
            defaultValue={JSON.stringify(event)}
            uniquenessKey={event._id}
            readOnly
          />
        </div>
      </EditorWrapper>
    </div>
  );
};
