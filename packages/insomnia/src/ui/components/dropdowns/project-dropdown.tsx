import React, { FC, Fragment, useState } from 'react';
import { useFetcher } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { strings } from '../../../common/strings';
import {
  Project,
} from '../../../models/project';
import { Button } from '../base/dropdown-aria/button';
import { Dropdown, DropdownItem, ItemContent } from '../base/dropdown-aria/dropdown';
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
          <Button variant='text' style={{ padding: 0 }}>
            <i className="fa fa-ellipsis space-left" />
          </Button>
        }
      >
        <DropdownItem>
          <ItemContent icon="gear" label={`${strings.project.singular} Settings`} onClick={() => setIsSettingsModalOpen(true)} />
        </DropdownItem>
        <DropdownItem>
          <PromptButton
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
