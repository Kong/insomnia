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

const SidebarPanel = ({ parent, children }: Props) => (
  <StyledPanel
    initial={{ height: parent ? '100%' : '0px' }}
    animate={{ height: parent ? '100%' : '0px' }}
    transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
    {children}
  </StyledPanel>
);

export default SidebarPanel;
