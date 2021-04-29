import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  childrenVisible: boolean;
}

const StyledPanel = styled(motion.div)`
  height: 0;
`;

export const SidebarPanel: FunctionComponent<Props> = ({ childrenVisible, children }) => (
  <StyledPanel
    initial={{
      height: childrenVisible ? '100%' : '0px',
    }}
    animate={{
      height: childrenVisible ? '100%' : '0px',
    }}
    transition={{
      duration: 0.2,
      ease: 'easeInOut',
      delay: 0,
    }}>
    {children}
  </StyledPanel>
);
