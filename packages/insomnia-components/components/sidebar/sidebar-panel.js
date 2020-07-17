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
  .method {
    h6 {
      font-size: var(--font-size-xxs);
    }
  }
  .method-post {
    color: var(--color-success);
  }
  .method-get {
    color: var(--color-surprise);
  }
  .method-delete {
    color: var(--color-danger);
  }
  .method-parameters {
    display: none;
  }
  .method-options-head,
  .method-custom {
    color: var(--color-info);
  }
  .method-patch {
    color: var(--color-notice);
  }
  .method-put {
    color: var(--color-warning);
  }
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
