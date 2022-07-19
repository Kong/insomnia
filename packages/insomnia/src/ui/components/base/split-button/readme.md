# SplitButton

This button allows to list several buttons as a split button

## Usage

### Imaginary WebSocket Usecase

The WebSocket hook API and the UI component APIs are totally imaginery.

```jsx
import React, { useState } from 'react';
import { SplitButton } from '../components/base/split-button';

const SendButtonForWebSocket = ({ workspaceId }) => {
  const { idle, connection, connect, close } = useWebSocket(workspaceId);
  return (
    <SplitButton disabled={idle}>
      {connection && <button name="wsSendButton" type="submit">Send</button>}
      {!connection && <button name="wsConnectButton" onClick={connect}>Connect</button>}
      <button name="wsCloseButton" onClick={close} disabled={!connection}>Close</button>
    </SplitButton>
  );
};

const WebSocketLeftPanel = ({ workspaceId }) => {
  const { sendMessage } = useWebSocket(workspaceId);
  return (
    <Pane>
      <PaneHeader>
        <form onSubmit={sendMessage}>
          <ConnectionIndicator>
          <ConnectionUrlControl>
          <SendButtonForWebSocket workspaceId="workspace1234" />;        
        </form>
      </PaneHeader>
    </Pane>
  );
};
```
