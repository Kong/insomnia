import React, { ChangeEvent, FunctionComponent, ReactNode, useCallback, useLayoutEffect, useState } from 'react';

import { SidebarHeader } from './sidebar-header';
import { SidebarPanel } from './sidebar-panel';
import { SidebarFilter } from './sidebar-filter';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useToggle } from 'react-use';

export interface SidebarSectionProps {
  title: string;
  renderBody: (filterValue: string) => ReactNode;
}

const StyledSection = styled(motion.ul)`
  overflow: hidden;
  box-sizing: border-box;
  border-bottom: 1px solid var(--hl-md);
`;

const StyledNoResults = styled.div`
  padding: var(--padding-xs) var(--padding-xs) var(--padding-md) var(--padding-md);
  color: var(--color-warning);
`;

export const SidebarSection: FunctionComponent<SidebarSectionProps> = ({ title, renderBody }) => {
  const [bodyVisible, toggleBodyVisible] = useToggle(false);
  const [filterVisible, toggleFilterVisible] = useToggle(false);
  const [filterValue, setFilterValue] = useState('');

  const handleFilterChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFilterValue(event.target.value);
  }, []);

  useLayoutEffect(() => {
    toggleFilterVisible(false);
    setFilterValue('');
  }, [bodyVisible, toggleFilterVisible]);

  return (
    <StyledSection>
      <SidebarHeader
        headerTitle={title}
        sectionVisible={bodyVisible}
        toggleSection={toggleBodyVisible}
        toggleFilter={toggleFilterVisible}
      />
      <SidebarPanel childrenVisible={bodyVisible}>
        <SidebarFilter filter={filterVisible} onChange={handleFilterChange} />
        {renderBody(filterValue) || (
          <StyledNoResults>No results found for "{filterValue}"...</StyledNoResults>
        )}
      </SidebarPanel>
    </StyledSection>
  );
};
