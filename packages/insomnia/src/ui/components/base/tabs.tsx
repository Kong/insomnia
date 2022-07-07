import { Tab as UnstyledTab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

/**
 * Create a wrapper styled Tab component.
 */
const Tab = styled(UnstyledTab).attrs({
  selectedClassName: 'selected',
  tabIndex: '0',
})`
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--line-height-sm);
  border: 1px solid transparent;
  border-bottom: 1px solid var(--hl-md);
  border-top: 0;
  white-space: nowrap;
  position: relative;
  padding: 0 var(--padding-md);
  color: var(--hl);

  &.selected {
    border-left: 1px solid var(--hl-md);
    border-right: 1px solid var(--hl-md);
  }
`;

export { Tab, TabList, TabPanel, Tabs };
