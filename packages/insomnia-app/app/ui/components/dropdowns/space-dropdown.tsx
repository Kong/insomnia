import { Dropdown, Tooltip, DropdownDivider, DropdownItem, SvgIcon, SvgIconProps } from 'insomnia-components';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { getAppName } from '../../../common/constants';
import { strings } from '../../../common/strings';
import { BASE_SPACE_ID, Space } from '../../../models/space';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteSpaces } from '../../hooks/space';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/space';
import { selectActiveSpace, selectIsRemoteSpace, selectSpaces } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/space-settings-modal';

type SpaceSubset = Pick<Space, '_id' | 'name' | 'remoteId'>;

const baseSpace: SpaceSubset = {
  _id: BASE_SPACE_ID,
  name: getAppName(),
  remoteId: null,
};

const Checkmark = styled(SvgIcon)({
  // this is a bit of a hack/workaround to avoid some larger changes that we'd need to do with dropdown item icons
  marginTop: 1,
  '& svg': {
    fill: 'var(--color-surprise)',
  },
});

const StyledSvgIcon = styled(SvgIcon)({
  // this is a bit of a hack/workaround to avoid some larger changes that we'd need to do with dropdown item icons
  marginTop: 1,
  '& svg': {
    fill: 'var(--hl)',
  },
});

const TooltipIcon = ({ message, icon }: { message: string, icon: SvgIconProps['icon'] }) => (
  <Tooltip message={message} style={{ display: 'flex' }}>
    <StyledSvgIcon icon={icon} />
  </Tooltip>
);

const spinner = <i className="fa fa-spin fa-refresh" />;
const home = <TooltipIcon message="Base Space (Always Local)" icon="home" />;
const remoteSpace = <TooltipIcon message="Remote Space" icon="globe" />;
const localSpace = <TooltipIcon message="Local Space" icon="laptop" />;

interface Props {
  vcs?: VCS;
}

const BoldDropdownItem = styled(DropdownItem)({
  fontWeight: 500,
});

const SpaceDropdownItem: FC<{ space: SpaceSubset }> = ({
  space: {
    _id: spaceId,
    name,
  },
}) => {
  const dispatch = useDispatch();
  const setActive = useCallback((id: string) => dispatch(setActiveSpace(id)), [dispatch]);
  const isRemote = useSelector(selectIsRemoteSpace(spaceId));

  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = activeSpace || baseSpace;
  const isActiveSpace = spaceId === selectedSpace._id;
  const isBaseSpace = spaceId === baseSpace._id;

  return (
    <BoldDropdownItem
      key={spaceId}
      icon={isBaseSpace ? home : isRemote ? remoteSpace : localSpace}
      right={isActiveSpace && <Checkmark icon="checkmark" />}
      value={spaceId}
      onClick={setActive}
    >
      {name}
    </BoldDropdownItem>
  );
};
SpaceDropdownItem.displayName = 'DropdownItem';

export const SpaceDropdown: FC<Props> = ({ vcs }) => {
  const { loading, refresh } = useRemoteSpaces(vcs);

  // get list of spaces (which doesn't include the base space)
  const spaces = useSelector(selectSpaces);

  // figure out which space is selected
  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = activeSpace || baseSpace;
  const spaceHasSettings = selectedSpace !== baseSpace && selectedSpace.remoteId === null;

  // select a new space
  const dispatch = useDispatch();
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);
  const showSettings = useCallback(() => showModal(SpaceSettingsModal), []);

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={selectedSpace.name}>
      {selectedSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>
  ), [selectedSpace]);

  return (
    <Dropdown renderButton={button} onOpen={refresh}>
      <SpaceDropdownItem space={baseSpace} />

      <DropdownDivider>All spaces{' '}{loading && spinner}</DropdownDivider>

      {spaces.map(space => {
        return (
          <SpaceDropdownItem key={space._id} space={space} />
        );
      })}

      {spaceHasSettings && <>
        <DropdownDivider />
        <DropdownItem icon={<StyledSvgIcon icon="gear" />} onClick={showSettings}>
          {strings.space.singular} Settings
        </DropdownItem>
      </>}

      <DropdownDivider />
      <DropdownItem icon={<StyledSvgIcon icon="plus" />} onClick={createNew}>
        Create or join a {strings.space.singular.toLowerCase()}
      </DropdownItem>
    </Dropdown>
  );
};
