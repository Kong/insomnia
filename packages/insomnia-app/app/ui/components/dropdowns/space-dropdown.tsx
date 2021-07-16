import { Dropdown, DropdownDivider, DropdownItem } from 'insomnia-components';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { strings } from '../../../common/strings';
import { isBaseSpace, isLocalSpace, isNotBaseSpace, Space } from '../../../models/space';
import { VCS } from '../../../sync/vcs/vcs';
import { useRemoteSpaces } from '../../hooks/space';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/space-settings-modal';

const check = <i className="fa fa-check" />;
const cog = <i className="fa fa-cog" />;
const plus = <i className="fa fa-plus" />;
const spinner = <i className="fa fa-spin fa-refresh" />;
const home = <i className="fa fa-home" />;

interface Props {
  vcs?: VCS;
}

export const SpaceDropdown: FC<Props> = ({ vcs }) => {
  const { loading, refresh } = useRemoteSpaces(vcs);

  // get list of spaces
  const spaces = useSelector(selectSpaces);

  // figure out which space is selected
  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = activeSpace;
  const spaceHasSettings = isBaseSpace(selectedSpace) && isLocalSpace(selectedSpace);

  // select a new space
  const dispatch = useDispatch();
  const setActive = useCallback((id) => dispatch(setActiveSpace(id)), [dispatch]);
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);
  const showSettings = useCallback(() => showModal(SpaceSettingsModal), []);

  const renderDropdownItem = useCallback((space: Space) => (
    <DropdownItem
      key={space._id}
      icon={isBaseSpace(space) && home}
      right={space._id === selectedSpace._id && check}
      value={space._id}
      onClick={setActive}
    >
      {space.name}
    </DropdownItem>),
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
      {spaces.filter(isBaseSpace).map(renderDropdownItem)}
      <DropdownDivider>All spaces{' '}{loading && spinner}</DropdownDivider>
      {spaces.filter(isNotBaseSpace).map(renderDropdownItem)}
      {spaceHasSettings && <>
        <DropdownDivider />
        <DropdownItem icon={cog} onClick={showSettings}>
          {strings.space.singular} Settings
        </DropdownItem>
      </>}
      <DropdownDivider />
      <DropdownItem icon={plus} onClick={createNew}>
        Create new {strings.space.singular.toLowerCase()}
      </DropdownItem>
    </Dropdown>
  );
};
