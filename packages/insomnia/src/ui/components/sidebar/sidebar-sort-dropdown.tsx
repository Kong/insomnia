import React, { FunctionComponent } from 'react';

import { SORT_ORDERS, SortOrder, sortOrderName } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown-aria/dropdown';

interface Props {
  handleSort: (sortOrder: SortOrder) => void;
}

export const SidebarSortDropdown: FunctionComponent<Props> = ({ handleSort }) => (
  <Dropdown
    triggerButton={
      <DropdownButton className="btn btn--compact">
        <i className="fa fa-sort" />
      </DropdownButton>
    }
  >
    {SORT_ORDERS.map(order => (
      <DropdownItem key={order}>
        <ItemContent label={sortOrderName[order]} onClick={() => handleSort(order)} />
      </DropdownItem>
    ))}
  </Dropdown>
);
