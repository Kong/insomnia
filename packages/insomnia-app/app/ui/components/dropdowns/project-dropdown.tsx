import { Dropdown, DropdownDivider, DropdownItem, SvgIcon, SvgIconProps, Tooltip } from 'insomnia-components';
import { partition } from 'ramda';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { strings } from '../../../common/strings';
import { isDefaultProject, isRemoteProject, Project, projectHasSettings } from '../../../models/project';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteProjects } from '../../hooks/project';
import { setActiveProject } from '../../redux/modules/global';
import { createProject } from '../../redux/modules/project';
import { selectActiveProject, selectProjects } from '../../redux/selectors';
import { showModal } from '../modals';
import ProjectSettingsModal from '../modals/project-settings-modal';
import { svgPlacementHack, tooltipIconPlacementHack } from './dropdown-placement-hacks';

const Checkmark = styled(SvgIcon)({
  ...svgPlacementHack,
  '& svg': {
    fill: 'var(--color-surprise)',
  },
});

const StyledSvgIcon = styled(SvgIcon)({
  ...svgPlacementHack,
  '& svg': {
    fill: 'var(--hl)',
  },
});

const StyledTooltip = styled(Tooltip)({
  ...tooltipIconPlacementHack,
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
      icon={isDefault ? home : isRemote ? remoteProject : localProject}
      right={isActive && <Checkmark icon="checkmark" />}
      value={_id}
      onClick={setActive}
    >
      {name}
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

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={activeProject.name}>
      {activeProject.name}
      <i className="fa fa-caret-down space-left" />
    </button>
  ), [activeProject]);

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
    <Dropdown renderButton={button} onOpen={refresh}>
      {defaultProjects.map(renderProject)}
      <DropdownDivider>All {strings.project.plural.toLowerCase()}{' '}{loading && spinner}</DropdownDivider>
      {userProjects.map(renderProject)}
      {projectHasSettings(activeProject) && <>
        <DropdownDivider />
        <DropdownItem icon={<StyledSvgIcon icon="gear" />} onClick={showSettings}>
          {strings.project.singular} Settings
        </DropdownItem>
      </>}

      <DropdownDivider />
      <DropdownItem icon={<StyledSvgIcon icon="plus" />} onClick={createNew}>
        Create new {strings.project.singular.toLowerCase()}
      </DropdownItem>
    </Dropdown>
  );
};
