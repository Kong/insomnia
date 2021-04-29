import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

interface Props {
  name: string;
}

const StyledInvalidSection = styled.div`
  padding: var(--padding-xs) var(--padding-xs) var(--padding-md) var(--padding-md);
  color: var(--color-warning);
`;

export const SidebarInvalidSection: FunctionComponent<Props> = ({ name }) => (
  <StyledInvalidSection>Error: Invalid {name} specification.</StyledInvalidSection>
);
