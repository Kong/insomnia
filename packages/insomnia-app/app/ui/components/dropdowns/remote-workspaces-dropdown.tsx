import React, { FC } from 'react';
import { VCS } from '../../../sync/vcs/vcs';
import { Dropdown, DropdownDivider, DropdownItem, Button, Tooltip } from 'insomnia-components';
import HelpTooltip from '../help-tooltip';
import { strings } from '../../../common/strings';
import { isLoggedIn } from '../../../account/session';
import { useRemoteWorkspaces } from '../../hooks/workspace';
import { useSelector } from 'react-redux';
import { selectActiveSpace } from '../../redux/selectors';

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
    missingProjects,
    pullingProjects,
    pull,
  } = useRemoteWorkspaces(vcs || undefined);

  const isRemoteSpace = Boolean(useSelector(selectActiveSpace)?.remoteId);

  // Don't show the pull dropdown if we are not in a remote space
  if (!isRemoteSpace) {
    return null;
  }

  // Show a disabled button if remote space but not logged in
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
