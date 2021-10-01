import React, { FunctionComponent } from 'react';

import type { GrpcRequest } from '../../../models/grpc-request';
import type { Settings } from '../../../models/settings';
import { useGrpcRequestState } from '../../context/grpc';
import { GrpcSpinner } from '../grpc-spinner';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { GrpcTabbedMessages } from '../viewers/grpc-tabbed-messages';
import { Pane, PaneBody, PaneHeader } from './pane';

interface Props {
  forceRefreshKey: number;
  activeRequest: GrpcRequest;
  settings: Settings;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({ settings, activeRequest, forceRefreshKey }) => {
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
