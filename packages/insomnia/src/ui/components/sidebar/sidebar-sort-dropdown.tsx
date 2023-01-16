import React, { FunctionComponent } from 'react';

import { SORT_ORDERS, SortOrder, sortOrderName } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';

interface Props {
  handleSort: (sortOrder: SortOrder) => void;
}

export const SidebarSortDropdown: FunctionComponent<Props> = ({ handleSort }) => (
  <Dropdown
    aria-label="Sidebar Sort Dropdown"
    triggerButton={
      <DropdownButton
        className="btn btn--compact"
        disableHoverBehavior={false}
      >
        <i className="fa fa-sort" />
      </DropdownButton>
    }
  >
    {SORT_ORDERS.map(order => (
      <DropdownItem
        aria-label={sortOrderName[order]}
        key={order}
      >
        <ItemContent
          label={sortOrderName[order]}
          onClick={() => handleSort(order)}
        />
      </DropdownItem>
    ))}
  </Dropdown>
);
