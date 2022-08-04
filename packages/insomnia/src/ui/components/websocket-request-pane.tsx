import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import { Pane, PaneHeader } from './panes/pane';
import { WebsocketActionBar } from './websockets/action-bar';

interface Props {
  requestId: string;
}

const StretchedPaneHeader = styled(PaneHeader)({ '&&': { alignItems: 'stretch' } });
// const PaneHeader = styled.div({});

export const WebSocketRequestPane: FunctionComponent<Props> = ({ requestId }) => {
  return (
    <Pane type="request">
      <StretchedPaneHeader>
        <WebsocketActionBar requestId={requestId} />
      </StretchedPaneHeader>
    </Pane>
  );
};
