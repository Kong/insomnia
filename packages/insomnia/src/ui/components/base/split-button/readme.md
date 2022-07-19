# SplitButton

This button allows to list several buttons as a split button

## Usage

### Stateful (Connection aware) split group button

```jsx
import React, { useState } from 'react';
import { ButtonGroup, Button } from '@zendeskgarden/react-buttons';

const SendButtonForWebSocket = ({ workspaceId }) => {
  const { idle, connection, connect, close } = useWebSocket(workspaceId);
  return (
    <SplitButton disabled={idle}>
      {connection && <button name="wsSendButton" type="submit">Send</button>}
      {!connection && <button name="wsConnectButton" onClick={connect}>Connect</button>}
      <button name="wsCloseButton" onClick={close} disabled={!connection}>Close</button>
    </ButtonGroup>
  );
};

const WebSocketLeftPanel = ({ workspaceId }) => {
  const { sendMessage } = useWebSocket(workspaceId);
  return (
    <Pane>
      <PaneHeader>
        <form onSubmit={}>
          <ConnectionIndicator>
          <ConnectionUrlControl>
          <SendButtonForWebSocket workspaceId="workspace1234" />;        
        </form>
      </PaneHeader>
    </Pane>
  );
};
```
