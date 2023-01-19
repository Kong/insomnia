import React, { FC, useEffect } from 'react';
import { useFetcher, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { isLoggedIn } from '../../../account/session';
import { strings } from '../../../common/strings';
import { RemoteProject } from '../../../models/project';
import { RemoteCollectionsLoaderData } from '../../routes/remote-collections';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';

interface Props {
  project: RemoteProject;
}

const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    marginLeft: 'var(--padding-md)',
  },
});

export const RemoteWorkspacesDropdown: FC<Props> = ({ project: { remoteId } }) => {
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const { load, submit, data, state } = useFetcher<RemoteCollectionsLoaderData>();

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
        <StyledDropdownButton isDisabled>
          Pull <i className="fa fa-caret-down pad-left-sm" />
        </StyledDropdownButton>
      </Tooltip>
    );
  }

  return (
    <Dropdown
      aria-label='Remote Workspaces Dropdown'
      onOpen={() => load(`/organization/${organizationId}/project/${projectId}/remote-collections`)}
      triggerButton={
        <StyledDropdownButton
          variant='outlined'
          removePaddings={false}
          disableHoverBehavior={false}
        >
          Pull <i className="fa fa-caret-down pad-left-sm" />
        </StyledDropdownButton>
      }
    >
      <DropdownSection
        aria-label='Remote Workspaces Section'
        items={remoteBackendProjects.length === 0 ? [{
          id: 1,
          isDisabled: true,
          label: 'Nothing to pull',
        }] : []}
        title={
          <>
            Remote {strings.collection.plural}
            <HelpTooltip>
              These {strings.collection.plural.toLowerCase()} have been shared with
              you via Insomnia Sync and do not yet exist on your machine.
            </HelpTooltip>{' '}
            {state === 'loading' && <i className="fa fa-spin fa-refresh" />}
          </>
        }
      >
        {({ id, ...rest }) =>
          <DropdownItem aria-label='Nothing to pull'>
            <ItemContent {...rest} />
          </DropdownItem>
        }
      </DropdownSection>

      <DropdownSection
        aria-label='Remote Workspaces Section'
        items={remoteBackendProjects.length ? remoteBackendProjects : []}
        title={
          <>
            Remote {strings.collection.plural}
            <HelpTooltip>
              These {strings.collection.plural.toLowerCase()} have been shared with
              you via Insomnia Sync and do not yet exist on your machine.
            </HelpTooltip>{' '}
            {state === 'loading' && <i className="fa fa-spin fa-refresh" />}
          </>
        }
      >
        {({ id, name }) =>
          <DropdownItem
            key={id}
            aria-label={name}
          >
            <ItemContent
              icon={state === 'submitting' ? 'refresh fa-spin' : 'cloud-download'}
              label={<span>Pull <strong>{name}</strong></span>}
              onClick={() =>
                submit(
                  {
                    remoteId,
                    backendProjectId: id,
                  },
                  {
                    action: `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
                    method: 'post',
                  }
                )
              }
            />
          </DropdownItem>
        }
      </DropdownSection>
    </Dropdown>
  );
};
