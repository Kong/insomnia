import React, { FunctionComponent } from 'react';

import { SORT_ORDERS, SortOrder, sortOrderName } from '../../../common/constants';
import { Button } from '../base/dropdown-aria/button';
import { Dropdown, DropdownItem, ItemContent } from '../base/dropdown-aria/dropdown';

interface Props {
  handleSort: (sortOrder: SortOrder) => void;
}

export const SidebarSortDropdown: FunctionComponent<Props> = ({ handleSort }) => (
  <Dropdown
    triggerButton={
      <Button className="btn btn--compact">
        <i className="fa fa-sort" />
      </Button>
    }
  >
    {SORT_ORDERS.map(order => (
      <DropdownItem key={order}>
        <ItemContent label={sortOrderName[order]} onClick={() => handleSort(order)} />
      </DropdownItem>
    ))}
  </Dropdown>
);
