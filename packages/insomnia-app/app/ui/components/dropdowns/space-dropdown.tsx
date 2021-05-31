import { Dropdown, DropdownDivider, DropdownItem } from 'insomnia-components';
import React, { FC, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAppName } from '../../../common/constants';
import { strings } from '../../../common/strings';
import { BASE_SPACE_ID, Space } from '../../../models/space';
import { setActiveSpace } from '../../redux/modules/global';
import { createSpace } from '../../redux/modules/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';

const mapSpace = ({ _id, name }: Space) => ({ id: _id, name });
const defaultSpace = { id: BASE_SPACE_ID, name: getAppName() };

const check = <i className="fa fa-check" />;

export const SpaceDropdown: FC = () => {
  // get list of spaces
  const loadedSpaces = useSelector(selectSpaces);
  const spaces = [defaultSpace, ...(loadedSpaces.map(mapSpace))];

  // figure out which space is selected
  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = spaces.find(space => space.id === activeSpace?._id) || defaultSpace;

  // select a new space
  const dispatch = useDispatch();
  const setActive = useCallback((id) => dispatch(setActiveSpace(id)), [dispatch]);
  const createNew = useCallback(() => dispatch(createSpace()), [dispatch]);

  // dropdown button
  const button = useMemo(() => (
    <button type="button" className="row" title={selectedSpace.name}>
      {selectedSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>),
  [selectedSpace]);

  return <Dropdown renderButton={button}>
    {spaces.map(({ id, name }) => (
      <DropdownItem
        key={id}
        right={id === selectedSpace.id && check}
        value={id}
        onClick={setActive}
      >
        {name}
      </DropdownItem>
    ))}
    <DropdownDivider />
    <DropdownItem onClick={createNew}>Create new {strings.space.singular.toLowerCase()}</DropdownItem>
  </Dropdown>;
};
