// @flow
import * as React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

type Props = {
  parent: boolean,
  children: React.Node,
};

const StyledPanel: React.ComponentType<{}> = styled(motion.div)`
  height: 0;
`;

const SidebarPanel = ({ parent, children }: Props) => (
  <StyledPanel
    initial={{ height: parent ? '100%' : '0px' }}
    animate={{ height: parent ? '100%' : '0px' }}
    transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
    {children}
  </StyledPanel>
);

export default SidebarPanel;
