import React, { FC, Fragment, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import styled from 'styled-components';

import { toKebabCase } from '../../../common/misc';
import { strings } from '../../../common/strings';
import {
  Project,
} from '../../../models/project';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import ProjectSettingsModal from '../modals/project-settings-modal';
import { SvgIcon } from '../svg-icon';
import { svgPlacementHack } from './dropdown-placement-hacks';

const Item = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
  'i.fa': {
    width: 'unset !important',
  },
});

const StyledSvgIcon = styled(SvgIcon)({
  '&&': {
    ...svgPlacementHack,
    '& svg': {
      fill: 'var(--hl)',
    },
  },
});

interface Props {
  project: Project;
  organizationId: string;
}

export const ProjectDropdown: FC<Props> = ({ project, organizationId }) => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const deleteProjectFetcher = useFetcher();
  return (
    <Fragment>
      <Dropdown dataTestId={toKebabCase('ProjectDropDown-' + project.name)}>
        <DropdownButton className="row" title={project.name}>
          <i className="fa fa-ellipsis space-left" />
        </DropdownButton>
        <DropdownItem onClick={() => setIsSettingsModalOpen(true)}>
          <Item>
            <StyledSvgIcon icon="gear" />
            {strings.project.singular} Settings
          </Item>
        </DropdownItem>
        <DropdownItem
          buttonClass={PromptButton}
          onClick={() =>
            deleteProjectFetcher.submit(
              {},
              { method: 'post', action: `/organization/${organizationId}/project/${project._id}/delete` }
            )
          }
        >
          <Item>
            <i className="fa fa-trash-o" /> Delete
          </Item>
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
