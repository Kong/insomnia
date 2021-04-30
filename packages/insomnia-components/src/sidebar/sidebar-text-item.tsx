import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

export interface SidebarTextItemProps {
  label: string;
  headline: string;
}

const StyledTextItem = styled.span`
  display: block;
  padding-left: var(--padding-sm);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

export const SidebarTextItem: FunctionComponent<SidebarTextItemProps> = ({ label, headline }) => (
  <StyledTextItem>
    <strong>{label}</strong>
    <span>{headline}</span>
  </StyledTextItem>
);
