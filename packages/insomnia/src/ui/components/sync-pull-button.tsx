import React, { FC, ReactNode, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { VCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { WorkspaceLoaderData } from '../routes/workspace';
import { showError } from './modals';
interface Props {
  vcs: VCS;
  branch: string;
  onPull: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export const SyncPullButton: FC<Props> = props => {
  const { className, children, disabled } = props;
  const {
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    const { vcs, onPull, branch } = props;
    setLoading(true);
    const newVCS = vcs.newInstance();
    const oldBranch = await newVCS.getBranch();
    let failed = false;
    try {
      invariant(activeProject.remoteId, 'Project is not remote');
      // Clone old VCS so we don't mess anything up while working on other projects
      await newVCS.checkout([], branch);
      await newVCS.pull({ candidates: [], teamId: activeProject.parentId, teamProjectId: activeProject.remoteId });
    } catch (err) {
      showError({
        title: 'Pull Error',
        message: 'Failed to pull ' + branch,
        error: err,
      });
      failed = true;
    } finally {
      // We actually need to checkout the old branch again because the VCS
      // stores it on the filesystem. We should probably have a way to not
      // have to do this hack
      await newVCS.checkout([], oldBranch);
    }
    setLoading(false);
    if (!failed) {
      onPull?.();
    }
  };
  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      {loading && <i className="fa fa-spin fa-refresh space-right" />}
      {children || 'Pull'}
    </button>
  );
};
