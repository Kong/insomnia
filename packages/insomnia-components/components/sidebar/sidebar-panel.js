// @flow
import * as React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

type Props = {
  children: React.Node,
  childrenVisible: boolean,
};

const StyledPanel: React.ComponentType<{}> = styled(motion.div)`
  height: 0;
`;

const SidebarPanel = ({ childrenVisible, children }: Props) => (
  <StyledPanel
    initial={{ height: childrenVisible ? '100%' : '0px' }}
    animate={{ height: childrenVisible ? '100%' : '0px' }}
    transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
    {children}
  </StyledPanel>
);

export default SidebarPanel;
