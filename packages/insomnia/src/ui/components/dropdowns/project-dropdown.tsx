import React, { FC, Fragment, useState } from 'react';
import { useFetcher } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { strings } from '../../../common/strings';
import {
  Project,
} from '../../../models/project';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown/dropdown';
import { PromptButton } from '../base/prompt-button';
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
        dataTestId={toKebabCase(`ProjectDropDown-${project.name}`)}
        triggerButton={
          <DropdownButton className="row" title={project.name}>
            <i className="fa fa-ellipsis space-left" />
          </DropdownButton>
        }
      >
        <DropdownItem>
          <ItemContent
            icon="gear"
            style={{ gap: 'var(--padding-sm)' }}
            iconStyle={{ width: 'unset', fill: 'var(--hl)' }}
            label={`${strings.project.singular} Settings`}
            onClick={() => setIsSettingsModalOpen(true)}
          />
        </DropdownItem>
        <DropdownItem>
          <PromptButton
            fullWidth
            onClick={() =>
              deleteProjectFetcher.submit(
                {},
                { method: 'post', action: `/organization/${organizationId}/project/${project._id}/delete` }
              )
            }
          >
            <ItemContent icon="trash-o" label="Delete" />
          </PromptButton>
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
