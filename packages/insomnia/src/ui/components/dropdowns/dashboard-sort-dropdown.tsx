import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { DASHBOARD_SORT_ORDERS, type DashboardSortOrder, dashboardSortOrderName } from '../../../common/constants';
import { Dropdown, DropdownItem, ItemContent } from '../base/dropdown';

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
        <Button>
          <i className="fa fa-sort" />
        </Button>
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
