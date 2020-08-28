// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  name: string,
};

const StyledInvalidSection: React.ComponentType<{}> = styled.div`
  padding: var(--padding-xs) var(--padding-xs) var(--padding-md) var(--padding-md);
  color: var(--color-warning);
`;

const SidebarInvalidSection = ({ name }: Props) => (
  <StyledInvalidSection>Error: Invalid {name} specification.</StyledInvalidSection>
);

export default SidebarInvalidSection;
