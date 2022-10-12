import { partition } from 'ramda';
import React, { FC, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { strings } from '../../../common/strings';
import { isDefaultProject, isRemoteProject, Project, projectHasSettings } from '../../../models/project';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteProjects } from '../../hooks/project';
import { setActiveProject } from '../../redux/modules/global';
import { createProject } from '../../redux/modules/project';
import { selectActiveProject, selectProjects } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal } from '../modals';
import ProjectSettingsModal from '../modals/project-settings-modal';
import { SvgIcon, SvgIconProps } from '../svg-icon';
import { Tooltip } from '../tooltip';
import { svgPlacementHack, tooltipIconPlacementHack } from './dropdown-placement-hacks';

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

const StyledTooltip = styled(Tooltip)({
  '&&': {
    ...tooltipIconPlacementHack,
  },
});

const Item = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
});

const TooltipIcon = ({ message, icon }: { message: string; icon: SvgIconProps['icon'] }) => (
  <StyledTooltip message={message}>
    <StyledSvgIcon icon={icon} />
  </StyledTooltip>
);

const spinner = <i className="fa fa-spin fa-refresh" />;
const home = <TooltipIcon message={`${strings.defaultProject.singular} ${strings.project.singular} (Always ${strings.localProject.singular})`} icon="home" />;
const remoteProject = <TooltipIcon message={`${strings.remoteProject.singular} ${strings.project.singular}`} icon="globe" />;
const localProject = <TooltipIcon message={`${strings.localProject.singular} ${strings.project.singular}`} icon="laptop" />;

interface Props {
  vcs?: VCS;
}

const ProjectDropdownItem: FC<{
  project: Project;
  isActive: boolean;
  setActive: (projectId: string) => void;
}> = ({ isActive, project, setActive }) => {
  const { _id, name } = project;
  const isDefault = isDefaultProject(project);
  const isRemote = isRemoteProject(project);

  return (
    <DropdownItem
      key={_id}
      onClick={() => setActive(_id)}
    >
      <Item>

        {isDefault ? home : isRemote ? remoteProject : localProject}
        {name}
        {isActive && <Checkmark icon="checkmark" />}
      </Item>
    </DropdownItem>
  );
};
ProjectDropdownItem.displayName = DropdownItem.name; // This is required because the Dropdown component will otherwise silently disregard this component.

export const ProjectDropdown: FC<Props> = ({ vcs }) => {
  const { loading, refresh } = useRemoteProjects(vcs);

  const projects = useSelector(selectProjects);

  const activeProject = useSelector(selectActiveProject);
  const dispatch = useDispatch();
  const setActive = useCallback((projectId: string) => dispatch(setActiveProject(projectId)), [dispatch]);
  const createNew = useCallback(() => dispatch(createProject()), [dispatch]);
  const showSettings = useCallback(() => showModal(ProjectSettingsModal), []);

  const renderProject = useCallback((project: Project) => (
    <ProjectDropdownItem
      key={project._id}
      isActive={project._id === activeProject._id}
      setActive={setActive}
      project={project}
    />
  ), [setActive, activeProject._id]);

  const [defaultProjects, userProjects] = partition(isDefaultProject, projects);

  return (
    <Dropdown onOpen={refresh}>
      <DropdownButton className="row" title={activeProject.name}>
        {activeProject.name}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      {defaultProjects.map(renderProject)}
      <DropdownDivider>All {strings.project.plural.toLowerCase()}{' '}{loading && spinner}</DropdownDivider>
      {userProjects.map(renderProject)}
      {projectHasSettings(activeProject) && <>
        <DropdownDivider />
        <DropdownItem onClick={showSettings}>
          <Item><StyledSvgIcon icon="gear" />{strings.project.singular} Settings</Item>
        </DropdownItem>
      </>}

      <DropdownDivider />
      <DropdownItem onClick={createNew}>
        <Item><StyledSvgIcon icon="plus" /> Create new {strings.project.singular.toLowerCase()}</Item>
      </DropdownItem>
    </Dropdown>
  );
};
