import React, { FunctionComponent } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { GrpcRequestState } from '../../routes/debug';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { TabItem, Tabs } from '../base/tabs';
import { GRPCEditor } from '../editors/grpc-editor';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  grpcState: GrpcRequestState;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({ grpcState }) => {
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const {
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const { requestId } = useParams() as { requestId: string };

  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}`;

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
        <Tabs key={uniquenessKey} aria-label="Grpc tabbed messages tabs" isNested>
          {responseMessages?.sort((a, b) => a.created - b.created).map((m, index) => (
            <TabItem key={m.id} title={`Response ${index + 1}`}>
              <GRPCEditor content={m.text} readOnly />
            </TabItem>))}
        </Tabs>
      </PaneBody>
    </Pane>
  );
};
