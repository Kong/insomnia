// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages.js';
import SizeTag from '../tags/size-tag';
import StatusTag from '../tags/status-tag';
import TimeTag from '../tags/time-tag';
import type { Settings } from '../../../models/settings';
import type { GrpcRequest } from '../../../models/grpc-request';
import { useGrpcState } from '../../context/grpc/grpc-context';
import { findGrpcRequestState } from '../../context/grpc/grpc-reducer';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  settings: Settings,
};

const GrpcResponsePane = ({ settings, activeRequest, forceRefreshKey }: Props) => {
  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const grpcState = useGrpcState();
  const { responseMessages } = findGrpcRequestState(grpcState, activeRequest._id);

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
          messages={responseMessages}
        />
      </PaneBody>
    </Pane>
  );
};

export default GrpcResponsePane;
