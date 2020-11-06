// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages.js';
import SizeTag from '../tags/size-tag';
import StatusTag from '../tags/status-tag';
import TimeTag from '../tags/time-tag';
import type { Settings } from '../../../models/settings';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  workspace: Workspace,
  settings: Settings,
  response: ?Response,
};

const GrpcResponsePane = (props: Props) => {
  const { handleRender, nunjucksPowerUserMode, isVariableUncovered, workspace, settings } = props;

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          <StatusTag statusCode={0} statusMessage={'Error'} />
          <TimeTag milliseconds={0} />
          <SizeTag bytesRead={22} bytesContent={11} />
        </div>
      </PaneHeader>
      <PaneBody>
        <GrpcTabbedMessages
          singleTab
          readOnly
          settings={settings}
          workspace={workspace}
          handleRender={handleRender}
          isVariableUncovered={isVariableUncovered}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          bodyText={'{"reply": "hello, hello, hello"}'}
        />
      </PaneBody>
    </Pane>
  );
};

export default GrpcResponsePane;
