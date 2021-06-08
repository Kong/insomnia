import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import * as session from '../../../account/session';
import VCS from '../../../sync/vcs';
import type { Project } from '../../../sync/types';
import { Dropdown, DropdownDivider, DropdownItem, Button, Tooltip } from 'insomnia-components';
import type { Workspace } from '../../../models/workspace';
import HelpTooltip from '../help-tooltip';
import * as models from '../../../models';
import { database as db } from '../../../common/database';
import { showAlert } from '../modals';
import { strings } from '../../../common/strings';
import { useSelector } from 'react-redux';
import { selectActiveSpace, selectAllWorkspaces } from '../../redux/selectors';
import { isWorkspace } from '../../../models/helpers/is-model';

interface Props {
  className?: string;
  vcs?: VCS | null;
}

const useRemoteWorkspaces = (vcs?: VCS) => {
  // Fetch from redux
  const workspaces = useSelector(selectAllWorkspaces);
  const activeSpace = useSelector(selectActiveSpace);
  const spaceRemoteId = activeSpace?.remoteId || undefined;
  const spaceId = activeSpace?._id;

  // Local state
  const [loading, setLoading] = useState(false);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [remoteProjects, setRemoteProjects] = useState<Project[]>([]);
  const [pullingProjects, setPullingProjects] = useState<Record<string, boolean>>({});

  // Refresh remote spaces
  const refresh = useCallback(async () => {
    if (!vcs || !session.isLoggedIn()) {
      return;
    }

    setLoading(true);
    setRemoteProjects(await vcs.remoteProjects(spaceRemoteId));
    setLocalProjects(await vcs.localProjects());
    setLoading(false);
  },
  [spaceRemoteId, vcs]);

  // Find remote spaces that haven't been pulled
  const missingProjects = useMemo(() => remoteProjects.filter(({ id, rootDocumentId }) => {
    const localProjectExists = localProjects.find(p => p.id === id);
    const workspaceExists = workspaces.find(w => w._id === rootDocumentId);
    // Mark as missing if:
    //   - the project doesn't yet exists locally
    //   - the project exists locally but somehow the workspace doesn't anymore
    return !(workspaceExists && localProjectExists);
  }), [localProjects, remoteProjects, workspaces]);

  // Pull a remote space
  const pull = useCallback(async (project: Project) => {
    if (!vcs) {
      throw new Error('VCS is not defined');
    }

    setPullingProjects(state => ({ ...state, [project.id]: true }));

    try {
    // Clone old VCS so we don't mess anything up while working on other projects
      const newVCS = vcs.newInstance();
      // Remove all projects for workspace first
      await newVCS.removeProjectsForRoot(project.rootDocumentId);
      // Set project, checkout master, and pull
      const defaultBranch = 'master';
      await newVCS.setProject(project);
      await newVCS.checkout([], defaultBranch);
      const remoteBranches = await newVCS.getRemoteBranches();
      const defaultBranchMissing = !remoteBranches.includes(defaultBranch);

      // The default branch does not exist, so we create it and the workspace locally
      if (defaultBranchMissing) {
        const workspace: Workspace = await models.initModel(models.workspace.type, {
          _id: project.rootDocumentId,
          name: project.name,
          parentId: spaceId || null,
        });
        await db.upsert(workspace);
      } else {
        await newVCS.pull([]); // There won't be any existing docs since it's a new pull

        const flushId = await db.bufferChanges();

        // @ts-expect-error -- TSCONVERSION
        for (const doc of (await newVCS.allDocuments() || [])) {
          if (isWorkspace(doc)) {
            // @ts-expect-error parent id is optional for workspaces
            doc.parentId = spaceId || null;
          }
          await db.upsert(doc);
        }

        await db.flushChanges(flushId);
      }

      await refresh();
    } catch (err) {
      showAlert({
        title: 'Pull Error',
        message: `Failed to pull workspace. ${err.message}`,
      });
    } finally {
      setPullingProjects(state => ({ ...state, [project.id]: false }));
    }
  }, [vcs, refresh, spaceId]);

  // If the refresh callback changes, refresh
  useEffect(() => {
    (async () => { await refresh(); })();
  }, [refresh]);

  return {
    loading,
    missingProjects,
    pullingProjects,
    refresh,
    pull,
  };
};

const PullButton: FC<{disabled?: boolean, className?: string}> = ({ disabled, className }) => (
  <Button className={className} disabled={disabled}>
      Pull
    <i className="fa fa-caret-down pad-left-sm" />
  </Button>
);

export const RemoteWorkspacesDropdown: FC<Props> = ({ className, vcs }) => {
  const {
    loading,
    refresh,
    missingProjects,
    pullingProjects,
    pull,
  } = useRemoteWorkspaces(vcs || undefined);

  if (!session.isLoggedIn()) {
    return (
      <Tooltip message="Please log in to access your remote collections" position="bottom">
        <PullButton className={className} disabled />
      </Tooltip>
    );
  }

  return (
    <Dropdown onOpen={refresh} renderButton={<PullButton className={className} />}>
      <DropdownDivider>
        Remote {strings.collection.plural}
        <HelpTooltip>
          These {strings.collection.plural.toLowerCase()} have been shared with you via Insomnia
          Sync and do not yet exist on your machine.
        </HelpTooltip>{' '}
        {loading && <i className="fa fa-spin fa-refresh" />}
      </DropdownDivider>
      {missingProjects.length === 0 && (
        <DropdownItem disabled>Nothing to pull</DropdownItem>
      )}
      {missingProjects.map(p => (
        <DropdownItem
          key={p.id}
          stayOpenAfterClick
          value={p}
          onClick={pull}
          icon={
            pullingProjects[p.id] ? (
              <i className="fa fa-refresh fa-spin" />
            ) : (
              <i className="fa fa-cloud-download" />
            )
          }>
          <span>
            Pull <strong>{p.name}</strong>
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
