import React from 'react';
import { number, withKnobs } from '@storybook/addon-knobs';
import Dropdown from './dropdown';
import DropdownItem from './dropdown-item';
import DropdownDivider from './dropdown-divider';
import SvgIcon from '../svg-icon';
import Button from '../button';

export default {
  title: 'Navigation | Dropdown',
  decorators: [withKnobs],
};

export const _default = () => (
  <Dropdown
    renderButton={({ open }) => (
      <Button>
        Dropdown <SvgIcon icon={open ? 'chevron-up' : 'chevron-down'} />
      </Button>
    )}>
    <DropdownDivider>Awesome Dropdown</DropdownDivider>
    <DropdownItem icon={<SvgIcon icon="clock" />}>Check Time</DropdownItem>
    <DropdownItem icon={<SvgIcon icon="git-branch" />} right="CTRL+A">
      Create Branch
    </DropdownItem>
    <DropdownItem icon={<SvgIcon icon="github" />} disabled>
      Disabled Action
    </DropdownItem>
    <DropdownItem icon={<SvgIcon icon="empty" />}>Other Action</DropdownItem>
    <DropdownDivider />
    <DropdownItem icon={<SvgIcon icon="warning" />}>Don't Do it!</DropdownItem>
  </Dropdown>
);

export const rightAlign = () => (
  <Dropdown
    right
    renderButton={() => (
      <Button>
        Right Align <SvgIcon icon="chevron-down" />
      </Button>
    )}>
    <DropdownItem>Item 1</DropdownItem>
    <DropdownItem>Item 2</DropdownItem>
    <DropdownItem>Item 3</DropdownItem>
  </Dropdown>
);

export const manyItems = () => {
  const items = [];
  const numItems = number('Num Items', 100);
  for (let i = 0; i < numItems; i++) {
    items.push(<DropdownItem key={i}>Item {i + 1}</DropdownItem>);
  }

  return (
    <Dropdown
      right
      renderButton={() => (
        <Button>
          {numItems} Items <SvgIcon icon="chevron-down" />
        </Button>
      )}>
      {items}
    </Dropdown>
  );
};
