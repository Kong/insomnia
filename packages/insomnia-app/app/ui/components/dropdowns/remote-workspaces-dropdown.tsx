import { Button, Dropdown, DropdownDivider, DropdownItem, Tooltip } from 'insomnia-components';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import { isLoggedIn } from '../../../account/session';
import { strings } from '../../../common/strings';
import { isRemoteProject } from '../../../models/project';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteWorkspaces } from '../../hooks/workspace';
import { selectActiveProject } from '../../redux/selectors';
import HelpTooltip from '../help-tooltip';

interface Props {
  className?: string;
  vcs?: VCS | null;
}

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
    missingBackendProjects,
    pullingBackendProjects,
    pull,
  } = useRemoteWorkspaces(vcs || undefined);

  const project = useSelector(selectActiveProject);
  if (!project) {
    return null;
  }

  const isRemote = isRemoteProject(project);

  // Don't show the pull dropdown if we are not in a remote project
  if (!isRemote) {
    return null;
  }

  // Show a disabled button if remote project but not logged in
  if (!isLoggedIn()) {
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
      {missingBackendProjects.length === 0 && (
        <DropdownItem disabled>Nothing to pull</DropdownItem>
      )}
      {missingBackendProjects.map(p => (
        <DropdownItem
          key={p.id}
          stayOpenAfterClick
          value={p}
          onClick={pull}
          icon={
            pullingBackendProjects[p.id] ? (
              <i className="fa fa-refresh fa-spin" />
            ) : (
              <i className="fa fa-cloud-download" />
            )
          }
        >
          <span>
            Pull <strong>{p.name}</strong>
          </span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
