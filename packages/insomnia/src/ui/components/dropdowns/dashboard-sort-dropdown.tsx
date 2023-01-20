import React, { FC } from 'react';

import { DASHBOARD_SORT_ORDERS, DashboardSortOrder, dashboardSortOrderName } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';

interface DashboardSortDropdownProps {
  value: DashboardSortOrder;
  onSelect: (value: DashboardSortOrder) => void;
}

export const DashboardSortDropdown: FC<DashboardSortDropdownProps> = ({ onSelect, value }) => {
  return (
    <Dropdown
      aria-label='Dashboard Sort Dropdown'
      className="margin-left"
      triggerButton={
        <DropdownButton
          variant='outlined'
          removePaddings={false}
          disableHoverBehavior={false}
        >
          <i className="fa fa-sort" />
        </DropdownButton>
      }
    >
      {DASHBOARD_SORT_ORDERS.map(order => (
        <DropdownItem
          key={order}
          aria-label={dashboardSortOrderName[order]}
        >
          <ItemContent
            label={dashboardSortOrderName[order]}
            isSelected={order === value}
            onClick={() => onSelect(order)}
          />
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
