import React, { FunctionComponent } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { selectActiveEnvironment } from '../../redux/selectors';
import { GrpcRequestState } from '../../routes/debug';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { GrpcTabbedMessages } from '../viewers/grpc-tabbed-messages';
import { Pane, PaneBody, PaneHeader } from './pane';

interface Props {
  grpcState: GrpcRequestState;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({ grpcState }) => {
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const { requestId } = useParams() as { requestId: string };

  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment?.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}`;

  const { responseMessages, status, error } = grpcState;
  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          {grpcState.running && <i className='fa fa-refresh fa-spin margin-right-sm' />}
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
