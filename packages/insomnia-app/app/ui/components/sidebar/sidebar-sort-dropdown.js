// @flow
import * as React from 'react';
import { SortOrder, sortOrderName, SORT_ORDERS } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';

type Props = {
  handleSort: (sortOrder: SortOrder) => void,
};

const SidebarSortDropdown = (props: Props) => {
  const { handleSort } = props;

  return (
    <Dropdown>
      <DropdownButton className="btn btn--compact">
        <i className="fa fa-sort" />
      </DropdownButton>
      {SORT_ORDERS.map(order => (
        <DropdownItem onClick={() => handleSort(order)} key={order}>
          {sortOrderName[order]}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};

export default SidebarSortDropdown;
