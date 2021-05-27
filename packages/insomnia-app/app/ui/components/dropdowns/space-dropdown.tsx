import { Dropdown, DropdownItem } from 'insomnia-components';
import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getAppName } from '../../../common/constants';
import { BASE_SPACE_ID, Space } from '../../../models/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';

const mapSpace = ({ _id, name }: Space) => ({ id: _id, name });
const defaultSpace = { id: BASE_SPACE_ID, name: getAppName() };

export const SpaceDropdown: FC = () => {
  // get list of spaces
  const loadedSpaces = useSelector(selectSpaces);
  const spaces = [defaultSpace, ...(loadedSpaces.map(mapSpace))];

  // figure out which space is selected
  const activeSpace = useSelector(selectActiveSpace);
  const selectedSpace = spaces.find(space => space.id === activeSpace?._id) || defaultSpace;

  const button = useMemo(() => (
    <button type="button" className="row" title={selectedSpace.name}>
      {selectedSpace.name}
      <i className="fa fa-caret-down space-left" />
    </button>),
  [selectedSpace]);

  const icon = useMemo(() => <i className="fa fa-cog" />, []);
  const check = useMemo(() => <i className="fa fa-check" />, []);

  return <Dropdown renderButton={button}>
    {spaces.map(({ id, name }) => (
      <DropdownItem
        key={id}
        icon={icon}
        right={id === selectedSpace.id && check}
        value={id}
        onClick={(_e, id) => console.log(`clicked space ${id}`)}
      >
        {name}
      </DropdownItem>
    ))}
  </Dropdown>;
};
