import { Dropdown, DropdownDivider, DropdownItem, SvgIcon, SvgIconProps, Tooltip } from 'insomnia-components';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { strings } from '../../../common/strings';
import { isBaseSpace, isNotBaseSpace, isRemoteSpace, Space, spaceHasSettings } from '../../../models/space';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteSpaces } from '../../hooks/space';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/space-settings-modal';
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
const home = <TooltipIcon message={`${strings.baseSpace.singular} ${strings.space.singular} (Always ${strings.localSpace.singular})`} icon="home" />;
const remoteSpace = <TooltipIcon message={`${strings.remoteSpace.singular} ${strings.space.singular}`} icon="globe" />;
const localSpace = <TooltipIcon message={`${strings.localSpace.singular} ${strings.space.singular}`} icon="laptop" />;

interface Props {
  vcs?: VCS;
}

const SpaceDropdownItem: FC<{
  space: Space;
  isActive: boolean;
  setActive: (spaceId: string) => void;
}> = ({ isActive, space, setActive }) => {
  const { _id, name } = space;
  const isBase = isBaseSpace(space);
  const isRemote = isRemoteSpace(space);

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

  const spaces = useSelector(selectSpaces);

  const activeSpace = useSelector(selectActiveSpace);
  const dispatch = useDispatch();
  const setActive = useCallback((spaceId: string) => dispatch(setActiveSpace(spaceId)), [dispatch]);
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);
  const showSettings = useCallback(() => showModal(SpaceSettingsModal), []);

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={activeSpace.name}>
      {activeSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>
  ), [activeSpace]);

  const renderSpace = useCallback((space: Space) => (
    <SpaceDropdownItem
      key={space._id}
      isActive={space._id === activeSpace._id}
      setActive={setActive}
      space={space}
    />
  ), [setActive, activeSpace._id]);

  return (
    <Dropdown renderButton={button} onOpen={refresh}>
      {spaces.filter(isBaseSpace).map(renderSpace)}
      <DropdownDivider>All spaces{' '}{loading && spinner}</DropdownDivider>
      {spaces.filter(isNotBaseSpace).map(renderSpace)}
      {spaceHasSettings(activeSpace) && <>
        <DropdownDivider />
        <DropdownItem icon={<StyledSvgIcon icon="gear" />} onClick={showSettings}>
          {strings.space.singular} Settings
        </DropdownItem>
      </>}

      <DropdownDivider />
      <DropdownItem icon={<StyledSvgIcon icon="plus" />} onClick={createNew}>
        Create new {strings.space.singular.toLowerCase()}
      </DropdownItem>
    </Dropdown>
  );
};
