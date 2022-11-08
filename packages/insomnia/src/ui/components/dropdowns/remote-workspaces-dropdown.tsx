import React, { FC, useEffect } from 'react';
import { useFetcher, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { isLoggedIn } from '../../../account/session';
import { strings } from '../../../common/strings';
import { RemoteProject } from '../../../models/project';
import { RemoteCollectionsLoaderData } from '../../routes/remote-collections';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { HelpTooltip } from '../help-tooltip';
import { Button } from '../themed-button';
import { Tooltip } from '../tooltip';

interface Props {
  project: RemoteProject;
}

const PullButton = styled(Button)({
  '&&': {
    marginLeft: 'var(--padding-md)',
  },
});

const RemoteWorkspaceDropdownItem: FC<{
  remoteId: string;
  backendProjectId: string;
  name: string;
  projectId: string;
  organizationId: string;
}> = ({ remoteId, backendProjectId, name, projectId, organizationId }) => {
  const { submit, state } = useFetcher();

  return (
    <DropdownItem
      key={backendProjectId}
      stayOpenAfterClick
      onClick={() =>
        submit(
          {
            remoteId,
            backendProjectId,
          },
          {
            action: `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
            method: 'post',
          }
        )
      }
    >
      {state === 'submitting' ? (
        <i className="fa fa-refresh fa-spin" />
      ) : (
        <i className="fa fa-cloud-download" />
      )}
      <span>
        Pull <strong>{name}</strong>
      </span>
    </DropdownItem>
  );
};

RemoteWorkspaceDropdownItem.displayName = DropdownItem.name;

export const RemoteWorkspacesDropdown: FC<Props> = ({ project }) => {
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const { load, data, state } = useFetcher<RemoteCollectionsLoaderData>();

  useEffect(() => {
    if (isLoggedIn() && projectId && state === 'idle' && !data) {
      load(`/organization/${organizationId}/project/${projectId}/remote-collections`);
    }
  }, [data, load, organizationId, projectId, state]);

  const remoteBackendProjects = data?.remoteBackendProjects ?? [];

  // Show a disabled button if remote project but not logged in
  if (!isLoggedIn()) {
    return (
      <Tooltip
        message="Please log in to access your remote collections"
        position="bottom"
      >
        <PullButton disabled>
          Pull <i className="fa fa-caret-down pad-left-sm" />
        </PullButton>
      </Tooltip>
    );
  }

  return (
    <Dropdown onOpen={() => load(`/organization/${organizationId}/project/${projectId}/remote-collections`)}>
      <DropdownButton buttonClass={PullButton}>
        Pull <i className="fa fa-caret-down pad-left-sm" />
      </DropdownButton>
      <DropdownDivider>
        Remote {strings.collection.plural}
        <HelpTooltip>
          These {strings.collection.plural.toLowerCase()} have been shared with
          you via Insomnia Sync and do not yet exist on your machine.
        </HelpTooltip>{' '}
        {state === 'loading' && <i className="fa fa-spin fa-refresh" />}
      </DropdownDivider>
      {remoteBackendProjects.length === 0 && (
        <DropdownItem disabled>Nothing to pull</DropdownItem>
      )}
      {remoteBackendProjects.map(backendProject => (
        <RemoteWorkspaceDropdownItem
          projectId={project._id}
          key={backendProject.id}
          name={backendProject.name}
          backendProjectId={backendProject.id}
          remoteId={project.remoteId}
          organizationId={organizationId || ''}
        />
      ))}
    </Dropdown>
  );
};
