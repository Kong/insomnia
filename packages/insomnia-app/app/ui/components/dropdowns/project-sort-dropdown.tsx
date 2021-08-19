import { Button, Dropdown, DropdownItem, SvgIcon } from 'insomnia-components';
import React, { FC } from 'react';
import styled from 'styled-components';

import { Project_SORT_ORDERS, ProjectSortOrder, projectSortOrderName } from '../../../common/constants';
import { svgPlacementHack } from './dropdown-placement-hacks';

interface ProjectSortDropdownProps {
  value: ProjectSortOrder;
  onSelect: (value: ProjectSortOrder) => void;
}

const Checkmark = styled(SvgIcon)({
  ...svgPlacementHack,
  '& svg': {
    fill: 'var(--color-surprise)',
  },
});

export const ProjectSortDropdown: FC<ProjectSortDropdownProps> = ({ onSelect, value }) => {
  return (
    <Dropdown
      className="margin-left"
      renderButton={
        <Button>
          <i className="fa fa-sort" />
        </Button>
      }
    >
      {Project_SORT_ORDERS.map(order => (
        <DropdownItem
          value={order}
          onClick={onSelect}
          key={order}
          right={value === order && <Checkmark icon="checkmark" />}
        >
          {projectSortOrderName[order]}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};
