import { Dropdown, DropdownDivider, DropdownItem, SvgIcon } from 'insomnia-components';
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
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/space-settings-modal';

type SpaceSubset = Pick<Space, '_id' | 'name' | 'remoteId'>;

const defaultSpace: SpaceSubset = {
  _id: BASE_SPACE_ID,
  name: getAppName(),
  remoteId: null,
};

const cog = <i className="fa fa-cog" />;
const plus = <SvgIcon icon="plus" />;
const spinner = <i className="fa fa-spin fa-refresh" />;
const home = <SvgIcon icon="home" />;
const globe = <SvgIcon icon="globe" />;

const Checkmark = styled(SvgIcon)({
  fill: 'var(--color-surprise)',
});

const SpaceItem = styled(DropdownItem)({
  fontWeight: 500,
});

interface Props {
  vcs?: VCS;
}

export const SpaceDropdown: FC<Props> = ({ vcs }) => {
  const { loading, refresh } = useRemoteSpaces(vcs);

  // get list of spaces
  const spaces = useSelector(selectSpaces);

  // figure out which space is selected
  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = activeSpace || defaultSpace;
  const spaceHasSettings = selectedSpace !== defaultSpace && selectedSpace.remoteId === null;

  // select a new space
  const dispatch = useDispatch();
  const setActive = useCallback((id) => dispatch(setActiveSpace(id)), [dispatch]);
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);
  const showSettings = useCallback(() => showModal(SpaceSettingsModal), []);

  const renderDropdownItem = useCallback(({ _id, name }: SpaceSubset) => (
    <SpaceItem
      key={_id}
      icon={_id === defaultSpace._id ? home : globe}
      right={_id === selectedSpace._id && <Checkmark icon='checkmark' />}
      value={_id}
      onClick={setActive}
    >
      {name}
    </SpaceItem>),
  [selectedSpace, setActive]);

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={selectedSpace.name}>
      {selectedSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>
  ), [selectedSpace]);

  return (
    <Dropdown renderButton={button} onOpen={refresh}>
      {renderDropdownItem(defaultSpace)}
      <DropdownDivider>All spaces{' '}{loading && spinner}</DropdownDivider>

      {spaces.map(renderDropdownItem)}

      {spaceHasSettings && <>
        <DropdownDivider />
        <DropdownItem icon={cog} onClick={showSettings}>
          {strings.space.singular} Settings
        </DropdownItem>
      </>}

      <DropdownDivider />
      <DropdownItem icon={plus} onClick={createNew}>
        Create or join a {strings.space.singular.toLowerCase()}
      </DropdownItem>
    </Dropdown>
  );
};
