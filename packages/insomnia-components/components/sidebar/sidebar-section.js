// @flow
import * as React from 'react';
import { useLayoutEffect } from 'react';
import SidebarHeader from './sidebar-header';
import SidebarPanel from './sidebar-panel';
import SidebarFilter from './sidebar-filter';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useToggle } from 'react-use';

type SectionProps = {
  title: string,
  renderBody: (filterValue: string) => React.Node,
};

const StyledSection: React.ComponentType<{}> = styled(motion.ul)`
  overflow: hidden;
  box-sizing: border-box;
  border-bottom: 1px solid var(--hl-md);
`;

const StyledNoResults: React.ComponentType<{}> = styled.div`
  padding: var(--padding-xs) var(--padding-xs) var(--padding-md) var(--padding-md);
  color: var(--color-warning);
`;

const SidebarSection = ({ title, renderBody }: SectionProps) => {
  const [bodyVisible, toggleBodyVisible] = useToggle(false);
  const [filterVisible, toggleFilterVisible] = useToggle(false);
  const [filterValue, setFilterValue] = React.useState('');

  const handleFilterChange = React.useCallback((e: SyntheticInputEvent<HTMLInputElement>) => {
    setFilterValue(e.target.value);
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

export default SidebarSection;
