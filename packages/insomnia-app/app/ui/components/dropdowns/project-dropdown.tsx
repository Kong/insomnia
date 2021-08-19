import { Dropdown, DropdownDivider, DropdownItem, SvgIcon, SvgIconProps, Tooltip } from 'insomnia-components';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { strings } from '../../../common/strings';
import { isBaseProject, isNotBaseProject, isRemoteProject, Project, projectHasSettings } from '../../../models/project';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteSpaces } from '../../hooks/project';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/project';
import { selectActiveProject, selectProjects } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/project-settings-modal';
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

const TooltipIcon = ({ message, icon }: { message: string, icon: SvgIconProps['icon'] }) => (
  <StyledTooltip message={message}>
    <StyledSvgIcon icon={icon} />
  </StyledTooltip>
);

const spinner = <i className="fa fa-spin fa-refresh" />;
const home = <TooltipIcon message={`${strings.baseProject.singular} ${strings.project.singular} (Always ${strings.localProject.singular})`} icon="home" />;
const remoteSpace = <TooltipIcon message={`${strings.remoteProject.singular} ${strings.project.singular}`} icon="globe" />;
const localSpace = <TooltipIcon message={`${strings.localProject.singular} ${strings.project.singular}`} icon="laptop" />;

interface Props {
  vcs?: VCS;
}

const SpaceDropdownItem: FC<{
  space: Project;
  isActive: boolean;
  setActive: (projectId: string) => void;
}> = ({ isActive, space, setActive }) => {
  const { _id, name } = space;
  const isBase = isBaseProject(space);
  const isRemote = isRemoteProject(space);

  return (
    <DropdownItem
      key={_id}
      icon={isBase ? home : isRemote ? remoteSpace : localSpace}
      right={isActive && <Checkmark icon="checkmark" />}
      value={_id}
      onClick={setActive}
    >
      {name}
    </DropdownItem>
  );
};
SpaceDropdownItem.displayName = DropdownItem.name; // This is required because the Dropdown component will otherwise silently disregard this component.

export const SpaceDropdown: FC<Props> = ({ vcs }) => {
  const { loading, refresh } = useRemoteSpaces(vcs);

  const spaces = useSelector(selectProjects);

  const activeSpace = useSelector(selectActiveProject);
  const dispatch = useDispatch();
  const setActive = useCallback((projectId: string) => dispatch(setActiveSpace(projectId)), [dispatch]);
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);
  const showSettings = useCallback(() => showModal(SpaceSettingsModal), []);

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={activeSpace.name}>
      {activeSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>
  ), [activeSpace]);

  const renderSpace = useCallback((space: Project) => (
    <SpaceDropdownItem
      key={space._id}
      isActive={space._id === activeSpace._id}
      setActive={setActive}
      space={space}
    />
  ), [setActive, activeSpace._id]);

  return (
    <Dropdown renderButton={button} onOpen={refresh}>
      {spaces.filter(isBaseProject).map(renderSpace)}
      <DropdownDivider>All {strings.project.plural.toLowerCase()}{' '}{loading && spinner}</DropdownDivider>
      {spaces.filter(isNotBaseProject).map(renderSpace)}
      {projectHasSettings(activeSpace) && <>
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
