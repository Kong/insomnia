// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages.js';
import SizeTag from '../tags/size-tag';
import StatusTag from '../tags/status-tag';
import TimeTag from '../tags/time-tag';
import type { Settings } from '../../../models/settings';
import type { GrpcRequest } from '../../../models/grpc-request';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  settings: Settings,
};

const demoResponseMessages = [
  { id: '2', created: 1604589843467, text: '{"reply": "Hello Response 2"}' },
  { id: '3', created: 1604589843468, text: '{"reply": "Hello Response 3"}' },
  { id: '1', created: 1604589843466, text: '{"reply": "Hello Response 1"}' },
];
demoResponseMessages.sort((a, b) => a.created - b.created);

const GrpcResponsePane = ({ settings, activeRequest, forceRefreshKey }: Props) => {
  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

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
          uniquenessKey={uniquenessKey}
          settings={settings}
          tabNamePrefix="Response"
          messages={demoResponseMessages}
        />
      </PaneBody>
    </Pane>
  );
};

export default GrpcResponsePane;
