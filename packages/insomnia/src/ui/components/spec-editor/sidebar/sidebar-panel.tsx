import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';

export interface SidebarPanelProps {
  children: ReactNode;
  childrenVisible: boolean;
}

const StyledPanel = styled.div`
  height: 0;
`;

export const SidebarPanel: FunctionComponent<SidebarPanelProps> = ({ childrenVisible, children }) => (
  <StyledPanel>
    {children}
  </StyledPanel>
);
