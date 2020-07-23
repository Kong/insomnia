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

let itemPath = [];
const handleClick = items => {
  itemPath.push('info');
  itemPath.push.apply(itemPath, items);
  itemPath = [];
};

const SidebarTextItem = ({ label, headline }: Props) => (
  <StyledTextItem>
    <strong>{label}</strong>
    <span onClick={() => handleClick([headline])}>{headline}</span>
  </StyledTextItem>
);

export default SidebarTextItem;
