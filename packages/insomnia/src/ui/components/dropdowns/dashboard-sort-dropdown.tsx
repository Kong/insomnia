import React, { FC } from 'react';
import styled from 'styled-components';

import { DASHBOARD_SORT_ORDERS, DashboardSortOrder, dashboardSortOrderName } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown/dropdown';
import { SvgIcon } from '../svg-icon';
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

const Wrapper = styled.div({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const DashboardSortDropdown: FC<DashboardSortDropdownProps> = ({ onSelect, value }) => {
  return (
    <Dropdown
      className="margin-left"
      triggerButton={
        <DropdownButton>
          <i className="fa fa-sort" />
        </DropdownButton>
      }
    >
      {DASHBOARD_SORT_ORDERS.map(order => (
        <DropdownItem key={order}>
          <Wrapper>
            <ItemContent label={dashboardSortOrderName[order]} onClick={() => onSelect(order)} />
            {value === order && <Checkmark icon="checkmark" />}
          </Wrapper>
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
