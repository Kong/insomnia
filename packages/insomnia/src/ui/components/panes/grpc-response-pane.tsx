import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';

import type { GrpcRequest } from '../../../models/grpc-request';
import { useGrpcRequestState } from '../../context/grpc';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { selectActiveEnvironment } from '../../redux/selectors';
import { GrpcSpinner } from '../grpc-spinner';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { GrpcTabbedMessages } from '../viewers/grpc-tabbed-messages';
import { Pane, PaneBody, PaneHeader } from './pane';

interface Props {
  activeRequest: GrpcRequest;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({ activeRequest }) => {
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const activeEnvironment = useSelector(selectActiveEnvironment);
  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment?.modified}::${activeRequest?._id}::${gitVersion}::${activeRequestSyncVersion}`;

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
            tabNamePrefix="Response"
            messages={responseMessages}
          />
        )}
      </PaneBody>
    </Pane>
  );
};
