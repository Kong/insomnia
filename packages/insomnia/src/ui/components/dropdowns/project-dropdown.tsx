import { partition } from 'ramda';
import React, { FC } from 'react';
import { useFetcher, useNavigate, useRevalidator } from 'react-router-dom';
import styled from 'styled-components';

import { strings } from '../../../common/strings';
import {
  isDefaultProject,
  isRemoteProject,
  Project,
  projectHasSettings,
} from '../../../models/project';
import { useProjectLoaderData } from '../../routes/project';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal, showPrompt } from '../modals';
import ProjectSettingsModal from '../modals/project-settings-modal';
import { SvgIcon, SvgIconProps } from '../svg-icon';
import { Tooltip } from '../tooltip';
import {
  svgPlacementHack,
} from './dropdown-placement-hacks';

const Item = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
});

const Checkmark = styled(SvgIcon)({
  '&&': {
    ...svgPlacementHack,
    '& svg': {
      fill: 'var(--color-surprise)',
    },
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

const TooltipIcon = ({
  message,
  icon,
}: {
  message: string;
  icon: SvgIconProps['icon'];
}) => (
  <Tooltip message={message}>
    <StyledSvgIcon icon={icon} />
  </Tooltip>
);

const Spinner = () => <i className="fa fa-spin fa-refresh" />;
const HomeIcon = () => (
  <TooltipIcon
    message={`${strings.defaultProject.singular} ${strings.project.singular} (Always ${strings.localProject.singular})`}
    icon="home"
  />
);

const RemoteProjectIcon = () => (
  <TooltipIcon
    message={`${strings.remoteProject.singular} ${strings.project.singular}`}
    icon="globe"
  />
);
const LocalProjectIcon = () => (
  <TooltipIcon
    message={`${strings.localProject.singular} ${strings.project.singular}`}
    icon="laptop"
  />
);

interface Props {
  activeProject: Project;
}

export const ProjectDropdown: FC<Props> = ({ activeProject }) => {
  const { projects } = useProjectLoaderData();
  const { revalidate, state } = useRevalidator();
  const navigate = useNavigate();
  const { submit } = useFetcher();

  const [defaultProjects, userProjects] = partition(isDefaultProject, projects);

  return (
    <Dropdown onOpen={revalidate}>
      <DropdownButton className="row" title={activeProject.name}>
        {activeProject.name}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      {defaultProjects.map(project => {
        return (
          <DropdownItem
            key={project._id}
            onClick={() => navigate(`/project/${project._id}`)}
          >
            <Item>
              {isDefaultProject(project) ? (
                <HomeIcon />
              ) : isRemoteProject(project) ? (
                <RemoteProjectIcon />
              ) : (
                <LocalProjectIcon />
              )}
              {project.name}
              {project._id === activeProject._id && (
                <Checkmark icon="checkmark" />
              )}
            </Item>
          </DropdownItem>
        );
      })}
      <DropdownDivider>
        All {strings.project.plural.toLowerCase()}{' '}
        {state === 'loading' && <Spinner />}
      </DropdownDivider>
      {userProjects.map(project => {
        return (
          <DropdownItem
            key={project._id}
            onClick={() => navigate(`/project/${project._id}`)}
          >
            <Item>
              {isDefaultProject(project) ? (
                <HomeIcon />
              ) : isRemoteProject(project) ? (
                <RemoteProjectIcon />
              ) : (
                <LocalProjectIcon />
              )}
              {project.name}
              {project._id === activeProject._id && (
                <Checkmark icon="checkmark" />
              )}
            </Item>
          </DropdownItem>
        );
      })}
      {projectHasSettings(activeProject) && (
        <>
          <DropdownDivider />
          <DropdownItem onClick={() => showModal(ProjectSettingsModal)}>
            <Item>
              <StyledSvgIcon icon="gear" />
              {strings.project.singular} Settings
            </Item>
          </DropdownItem>
        </>
      )}

      <DropdownDivider />
      <DropdownItem
        onClick={() => {
          const defaultValue = `My ${strings.project.singular}`;

          showPrompt({
            title: `Create New ${strings.project.singular}`,
            submitName: 'Create',
            cancelable: true,
            placeholder: defaultValue,
            defaultValue,
            selectText: true,
            onComplete: async name =>
              submit(
                {
                  name,
                },
                {
                  action: '/project/new',
                  method: 'post',
                }
              ),
          });
        }}
      >
        <Item>
          <StyledSvgIcon icon="plus" /> Create new{' '}
          {strings.project.singular.toLowerCase()}
        </Item>
      </DropdownItem>
    </Dropdown>
  );
};
