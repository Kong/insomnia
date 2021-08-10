import React, { FunctionComponent } from 'react';

import { SORT_ORDERS, SortOrder, sortOrderName } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';

interface Props {
  handleSort: (sortOrder: SortOrder) => void;
}

const SidebarSortDropdown: FunctionComponent<Props> = ({ handleSort }) => (
  <Dropdown>
    <DropdownButton className="btn btn--compact">
      <i className="fa fa-sort" />
    </DropdownButton>
    {SORT_ORDERS.map(order => (
      <DropdownItem value={order} onClick={handleSort} key={order}>
        {sortOrderName[order]}
      </DropdownItem>
    ))}
  </Dropdown>
);

export default SidebarSortDropdown;
