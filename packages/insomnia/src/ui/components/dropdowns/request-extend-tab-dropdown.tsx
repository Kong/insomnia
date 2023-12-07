import React, { FC } from 'react';

import {
  REQUEST_UTIL_TABS_ORDER,
  REQUEST_UTIL_TABS_TITLE,
} from '../../../common/constants';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownSection,
  ItemContent,
} from '../base/dropdown';

interface Props {
  activeTab: typeof REQUEST_UTIL_TABS_ORDER[number];
  onChange: (tab: string) => void;
}

export const RequestExtendTabDropdown: FC<Props> = ({
  activeTab,
  onChange,
}) => {
  return (
    <Dropdown
      aria-label="Utils Dropdown"
      triggerButton={
        <DropdownButton className="tall">
          Utils - {REQUEST_UTIL_TABS_TITLE[activeTab]}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownSection aria-label="Utils section" title="Utils">
        {REQUEST_UTIL_TABS_ORDER.map(tab => (
          <DropdownItem key={tab} aria-label={REQUEST_UTIL_TABS_TITLE[tab]}>
            <ItemContent
              icon={activeTab === tab ? 'check' : 'empty'}
              label={REQUEST_UTIL_TABS_TITLE[tab]}
              onClick={() => onChange(tab)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>
    </Dropdown>
  );
};
