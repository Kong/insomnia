import React, { FC } from 'react';
import styled from 'styled-components';

import { DASHBOARD_SORT_ORDERS, DashboardSortOrder, dashboardSortOrderName } from '../../../common/constants';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { SvgIcon } from '../svg-icon';
import { Button } from '../themed-button';
import { svgPlacementHack } from './dropdown-placement-hacks';

interface DashboardSortDropdownProps {
  value: DashboardSortOrder;
  onSelect: (value: DashboardSortOrder) => void;
}

const Checkmark = styled(SvgIcon)({
  '&&': {
    ...svgPlacementHack,
    '& svg': {
      fill: 'var(--color-surprise)',
    },
  },
});

const Item = styled.div({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const DashboardSortDropdown: FC<DashboardSortDropdownProps> = ({ onSelect, value }) => {
  return (
    <Dropdown
      className="margin-left"
    >
      <DropdownButton buttonClass={Button}>
        <i className="fa fa-sort" />
      </DropdownButton>
      {DASHBOARD_SORT_ORDERS.map(order => (
        <DropdownItem
          onClick={() => onSelect(order)}
          key={order}
        >
          <Item>
            {dashboardSortOrderName[order]} {value === order && <Checkmark icon="checkmark" />}
          </Item>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
