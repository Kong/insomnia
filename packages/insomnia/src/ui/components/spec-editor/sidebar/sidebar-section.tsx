import React, { ChangeEvent, FunctionComponent, ReactNode, useCallback, useLayoutEffect, useState } from 'react';
import useToggle from 'react-use/lib/useToggle';
import styled from 'styled-components';

import { SidebarFilter } from './sidebar-filter';
import { SidebarHeader } from './sidebar-header';

export interface SidebarSectionProps {
  title: string;
  renderBody: (filterValue: string) => ReactNode;
}

const StyledSection = styled.ul`
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
      <div style={{ height: bodyVisible ? '100%' : 0 }}>
        <SidebarFilter filter={filterVisible} onChange={handleFilterChange} />
        {renderBody(filterValue) || (
          <StyledNoResults>No results found for "{filterValue}"...</StyledNoResults>
        )}
      </div>
    </StyledSection>
  );
};
