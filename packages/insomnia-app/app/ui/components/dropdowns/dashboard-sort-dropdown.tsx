import { Button, Dropdown, DropdownItem, SvgIcon } from 'insomnia-components';
import React, { FC } from 'react';
import styled from 'styled-components';

import { DASHBOARD_SORT_ORDERS, DashboardSortOrder, dashboardSortOrderName } from '../../../common/constants';
import { svgPlacementHack } from './dropdown-placement-hacks';

interface DashboardSortDropdownProps {
  value: DashboardSortOrder;
  onSelect: (value: DashboardSortOrder) => void;
}

const Checkmark = styled(SvgIcon)({
  ...svgPlacementHack,
  '& svg': {
    fill: 'var(--color-surprise)',
  },
});

export const DashboardSortDropdown: FC<DashboardSortDropdownProps> = ({ onSelect, value }) => {
  return (
    <Dropdown
      className="margin-left"
      renderButton={
        <Button>
          <i className="fa fa-sort" />
        </Button>
      }
    >
      {DASHBOARD_SORT_ORDERS.map(order => (
        <DropdownItem
          value={order}
          onClick={onSelect}
          key={order}
          right={value === order && <Checkmark icon="checkmark" />}
        >
          {dashboardSortOrderName[order]}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
