// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  label: string,
  headline: string,
};

const StyledTextItem: React.ComponentType<{}> = styled.span`
  display: block;
  padding-left: var(--padding-sm);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const SidebarTextItem = ({ label, headline }: Props) => (
  <StyledTextItem>
    <strong>{label}</strong>
    <span>{headline}</span>
  </StyledTextItem>
);

export default SidebarTextItem;
