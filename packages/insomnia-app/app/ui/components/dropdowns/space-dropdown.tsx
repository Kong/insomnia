import { Dropdown, DropdownDivider, DropdownItem } from 'insomnia-components';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isLoggedIn } from '../../../account/session';
import { getAppName } from '../../../common/constants';
import { strings } from '../../../common/strings';
import { BASE_SPACE_ID, Space } from '../../../models/space';
import VCS from '../../../sync/vcs';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';
import { showModal } from '../modals';
import SpaceSettingsModal from '../modals/space-settings-modal';
import * as models from '../../../models';
import { database } from '../../../common/database';

type SpaceSubset = Pick<Space, '_id'> & Pick<Space, 'name'> & Pick<Space, 'remoteId'>;

const defaultSpace: SpaceSubset = { _id: BASE_SPACE_ID, name: getAppName() };

const check = <i className="fa fa-check" />;
const cog = <i className="fa fa-cog" />;
const plus = <i className="fa fa-plus" />;
const spinner = <i className="fa fa-spin fa-refresh" />;
const home = <i className="fa fa-home" />;

interface Props {
  vcs?: VCS;
}

const useRemoteSpaces = (vcs?: VCS) => {
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (vcs && isLoggedIn()) {
      setLoading(true);
      const teams = await vcs.teams();
      const spaces = await Promise.all(teams.map(team => models.initModel<Space>(models.space.type, { _id: team.id, name: team.name })));
      await database.batchModifyDocs({ upsert: spaces });
      setLoading(false);
    }
  }, [vcs]);

  useEffect(() => {
    const fetch = async () => {
      await refresh();
    };
    fetch();
  }, [refresh]);

  return { loading, refresh };
};

export const SpaceDropdown: FC<Props> = ({ vcs }) => {
  const { loading, refresh } = useRemoteSpaces(vcs);

  // get list of spaces
  const spaces = useSelector(selectSpaces);

  // figure out which space is selected
  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = activeSpace || defaultSpace;
  const spaceHasSettings = selectedSpace !== defaultSpace;

  // select a new space
  const dispatch = useDispatch();
  const setActive = useCallback((id) => dispatch(setActiveSpace(id)), [dispatch]);
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);
  const showSettings = useCallback(() => showModal(SpaceSettingsModal), []);

  const renderDropdownItem = useCallback(({ _id, name }: SpaceSubset) => (
    <DropdownItem
      key={_id}
      icon={_id === defaultSpace._id && home}
      right={_id === selectedSpace._id && check}
      value={_id}
      onClick={setActive}
    >
      {name}
    </DropdownItem>),
  [selectedSpace, setActive]);

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={selectedSpace.name}>
      {selectedSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>),
  [selectedSpace]);

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
        Create new {strings.space.singular.toLowerCase()}
      </DropdownItem>
    </Dropdown>
  );
};
