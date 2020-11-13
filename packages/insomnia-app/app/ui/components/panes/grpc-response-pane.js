// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages.js';
import type { Settings } from '../../../models/settings';
import type { GrpcRequest } from '../../../models/grpc-request';
import GrpcStatusTag from '../tags/grpc-status-tag';
import GrpcSpinner from '../grpc-spinner';
import { useGrpcRequestState } from '../../context/grpc';

type Props = {
  forceRefreshKey: string,
  activeRequest: GrpcRequest,
  settings: Settings,
};

const GrpcResponsePane = ({ settings, activeRequest, forceRefreshKey }: Props) => {
  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const { responseMessages, status, error } = useGrpcRequestState(activeRequest._id);

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          <GrpcSpinner requestId={activeRequest._id} className="margin-right-sm" />
          {status && <GrpcStatusTag statusCode={status.code} statusMessage={status.details} />}
          {!status && error && <GrpcStatusTag statusMessage={error.message} />}
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
