import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

interface Props {
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

export const SidebarTextItem: FunctionComponent<Props> = ({ label, headline }) => (
  <StyledTextItem>
    <strong>{label}</strong>
    <span>{headline}</span>
  </StyledTextItem>
);
