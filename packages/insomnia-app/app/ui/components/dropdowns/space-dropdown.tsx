import { Dropdown, DropdownDivider, DropdownItem } from 'insomnia-components';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { getAppName } from '../../../common/constants';
import { Space } from '../../../models/space';
import { selectActiveSpace, selectSpaces } from '../../redux/selectors';

export const SpaceDropdown: FC = () => {
  const loadedSpaces = (useSelector(selectSpaces) as Space[]).map(space => ({ id: space._id, name: space.name }));
  const activeSpaceId = (useSelector(selectActiveSpace) as Space | null)?._id;

  const defaultSpace = { id: null, name: getAppName() };

  const spaces = [defaultSpace, ...loadedSpaces];

  const button = <button type="button" className="row">
    <div
      title={spaceName}>
      {spaceName}
    </div>
    <i className="fa fa-caret-down space-left" />
  </button>;

  return <Dropdown renderButton={button}>
    <DropdownItem icon={<i className="fa fa-cog" />} right={<i className="fa fa-check" />}>Space 1</DropdownItem>
    <DropdownItem icon={<i className="fa fa-cog" />}>Space 2</DropdownItem>
    <DropdownDivider />
    <DropdownItem icon={<></>}>Settings</DropdownItem>
    <DropdownItem icon={<></>}>Create a space</DropdownItem>
  </Dropdown>;
};
