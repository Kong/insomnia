import React, { FC, Fragment, useState } from 'react';
import { useFetcher } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { strings } from '../../../common/strings';
import {
  Project,
} from '../../../models/project';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import ProjectSettingsModal from '../modals/project-settings-modal';

interface Props {
  project: Project;
  organizationId: string;
}

export const ProjectDropdown: FC<Props> = ({ project, organizationId }) => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const deleteProjectFetcher = useFetcher();
  return (
    <Fragment>
      <Dropdown
        aria-label='Project Dropdown'
        dataTestId={toKebabCase(`ProjectDropDown-${project.name}`)}
        triggerButton={
          <DropdownButton className="row" title={project.name}>
            <i className="fa fa-ellipsis space-left" />
          </DropdownButton>
        }
      >
        <DropdownItem aria-label={`${strings.project.singular} Settings`}>
          <ItemContent
            icon="gear"
            style={{ gap: 'var(--padding-sm)' }}
            iconStyle={{ width: 'unset', fill: 'var(--hl)' }}
            label={`${strings.project.singular} Settings`}
            onClick={() => setIsSettingsModalOpen(true)}
          />
        </DropdownItem>
        <DropdownItem aria-label='Delete'>
          <ItemContent
            icon="trash-o"
            label="Delete"
            withPrompt
            onClick={() =>
              deleteProjectFetcher.submit(
                {},
                { method: 'post', action: `/organization/${organizationId}/project/${project._id}/delete` }
              )
            }
          />
        </DropdownItem>
      </Dropdown>
      {isSettingsModalOpen && (
        <ProjectSettingsModal
          onHide={() => setIsSettingsModalOpen(false)}
          project={project}
        />
      )}
    </Fragment>
  );
};
