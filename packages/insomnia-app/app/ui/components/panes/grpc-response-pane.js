// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages.js';
import type { Settings } from '../../../models/settings';
import type { GrpcRequest } from '../../../models/grpc-request';
import { useGrpcState } from '../../context/grpc/grpc-context';
import { findGrpcRequestState } from '../../context/grpc/grpc-reducer';
import GrpcStatusTag from '../tags/grpc-status-tag';

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
  const { responseMessages, status, error } = findGrpcRequestState(grpcState, activeRequest._id);

  if (error) {
    // TODO: How do we want to display this?
    console.error(error);
  }

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          {status && <GrpcStatusTag statusCode={status.code} statusMessage={status.details} />}
          {/* <TimeTag milliseconds={0} /> */}
          {/* <SizeTag bytesRead={22} bytesContent={11} /> */}
        </div>
      </PaneHeader>
      <PaneBody>
        {!!responseMessages.length && (
          <GrpcTabbedMessages
            uniquenessKey={uniquenessKey}
            settings={settings}
            tabNamePrefix="Response"
            messages={responseMessages}
          />
        )}
      </PaneBody>
    </Pane>
  );
};

export default GrpcResponsePane;
