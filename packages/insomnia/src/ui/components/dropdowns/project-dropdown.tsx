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
        items={[{
          label: `${strings.project.singular} Settings`,
          onClick: () => setIsSettingsModalOpen(true),
          icon: 'gear',
          iconStyle: { width: 'unset', fill: 'var(--hl)' },
          style: { gap: 'var(--padding-sm)' },
        }, ...!project._id.startsWith('proj_team') ? [{
          label: 'Delete',
          onClick: () =>
            deleteProjectFetcher.submit(
              {},
              { method: 'post', action: `/organization/${organizationId}/project/${project._id}/delete` }
            ),
          icon: 'trash-o',
          withPrompt: true,
        }] : [],
        ]}
      >
        {item => (

          <DropdownItem aria-label={`${strings.project.singular} Settings`}>
            <ItemContent
              key={item.label}
              {...item}
            />
          </DropdownItem>
        )}
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
