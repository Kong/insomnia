import { Dropdown, Tooltip, DropdownDivider, DropdownItem, SvgIcon, SvgIconProps } from 'insomnia-components';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { getAppName } from '../../../common/constants';
import { strings } from '../../../common/strings';
import { BASE_SPACE_ID, isBaseSpace, isRemoteSpace, Space, spaceHasSettings } from '../../../models/space';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteSpaces } from '../../hooks/space';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/space-settings-modal';

type SpaceSubset = Pick<Space, '_id' | 'name' | 'remoteId'>;

const baseSpace: SpaceSubset = {
  _id: BASE_SPACE_ID,
  name: getAppName(),
  remoteId: null,
};

const svgPlacementHack = {
  // This is a bit of a hack/workaround to avoid some larger changes that we'd need to do with dropdown item icons and tooltips.
  // Without this, the icon is too high with respect to the text because of Tooltip introducing some changes to the placement of the icon.
  marginTop: 1,
};

const tooltipIconPlacementHack = {
  // see above comment for `svgPlacementHack`.
  marginTop: 3,
};

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
const home = <TooltipIcon message="Base Space (Always Local)" icon="home" />;
const remoteSpace = <TooltipIcon message="Remote Space" icon="globe" />;
const localSpace = <TooltipIcon message="Local Space" icon="laptop" />;

interface Props {
  vcs?: VCS;
}

const SpaceDropdownItem: FC<{
  space: SpaceSubset;
  activeSpace: SpaceSubset;
  setActive: (spaceId: string) => void;
}> = ({ activeSpace, space, setActive }) => {
  const { _id, name } = space;
  const isActive = _id === activeSpace._id;
  const isBase = isBaseSpace(space);
  const isRemote = isRemoteSpace(space);

  return (
    <DropdownItem
      key={_id}
      icon={isBase ? home : isRemote ? remoteSpace : localSpace}
      right={isActive && <Checkmark icon="checkmark" />}
      // @ts-expect-error DropdownItem's relationship between `value` and the `onClick` callback still needs some work
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

  // get list of spaces (which doesn't include the base space)
  const spaces = useSelector(selectSpaces);

  const activeSpace = useSelector(selectActiveSpace) || baseSpace;
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

  return (
    <Dropdown renderButton={button} onOpen={refresh}>
      <SpaceDropdownItem
        space={baseSpace}
        activeSpace={activeSpace}
        setActive={setActive}
      />

      <DropdownDivider>All spaces{' '}{loading && spinner}</DropdownDivider>

      {spaces.map(space => (
        <SpaceDropdownItem
          key={space._id}
          space={space}
          activeSpace={activeSpace}
          setActive={setActive}
        />
      ))}

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
