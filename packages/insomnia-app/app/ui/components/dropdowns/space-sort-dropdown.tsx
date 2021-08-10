import { Button, Dropdown, DropdownItem, SvgIcon } from 'insomnia-components';
import React, { FC } from 'react';
import styled from 'styled-components';

import { SPACE_SORT_ORDERS, SpaceSortOrder, spaceSortOrderName } from '../../../common/constants';

interface SpaceSortDropdownProps {
  value: SpaceSortOrder;
  onSelect: (value: SpaceSortOrder) => void;
}

const Checkmark = styled(SvgIcon)({
  // @TODO Update this once we improve the way we show icons in the DropdownItem
  marginTop: 1,
  '& svg': {
    fill: 'var(--color-surprise)',
  },
});

export const SpaceSortDropdown: FC<SpaceSortDropdownProps> = ({ onSelect, value }) => {
  return (
    <Dropdown
      className="margin-left"
      renderButton={
        <Button>
          <i className="fa fa-sort" />
        </Button>
      }
    >
      {SPACE_SORT_ORDERS.map(order => (
        <DropdownItem
          value={order}
          onClick={onSelect}
          key={order}
          right={value == order && <Checkmark icon="checkmark" />}
        >
          {spaceSortOrderName[order]}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
