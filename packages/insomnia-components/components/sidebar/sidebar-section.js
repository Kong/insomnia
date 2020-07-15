// @flow
import * as React from 'react';
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

const SidebarSection = ({ title, renderBody }: SectionProps) => {
  const [bodyVisible, toggleBodyVisible] = useToggle(false);
  const [filterVisible, toggleFilterVisible] = useToggle(false);
  const [filterValue, setFilterValue] = React.useState('');

  const handleFilterChange = React.useCallback((e: SyntheticInputEvent<HTMLInputElement>) => {
    setFilterValue(e.target.value);
  }, []);

  return (
    <StyledSection>
      <SidebarHeader
        headerTitle={title}
        sectionVisible={bodyVisible}
        toggleSection={toggleBodyVisible}
        toggleFilter={toggleFilterVisible}
      />
      <SidebarPanel parent={bodyVisible}>
        <SidebarFilter filter={filterVisible} onChange={handleFilterChange} />
        {renderBody(filterValue)}
      </SidebarPanel>
    </StyledSection>
  );
};

export default SidebarSection;
