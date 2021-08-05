import { Button, Dropdown, DropdownItem } from 'insomnia-components';
import React, { FC } from 'react';

import { SPACE_SORT_ORDERS, SpaceSortOrder, spaceSortOrderName } from '../../../common/constants';

interface SpaceSortDropdownProps {
  onSelect: (value: SpaceSortOrder) => void;
}

export const SpaceSortDropdown: FC<SpaceSortDropdownProps> = ({ onSelect }) => {
  return (
    <Dropdown
      className="margin-left"
      renderButton={
        <Button>
          <i className="fa fa-sort" />
        </Button>
      }
    >
      {SPACE_SORT_ORDERS.map(order => (
        <DropdownItem value={order} onClick={onSelect} key={order}>
          {spaceSortOrderName[order]}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};