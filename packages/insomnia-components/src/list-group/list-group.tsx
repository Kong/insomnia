import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';

interface Props {
  children?: ReactNode;
  bordered?: boolean;
}

const StyledListGroup = styled.ul<Props>`
  list-style-type: none;
  margin: 0;
  padding: 0;

  ${({ bordered }) =>
    bordered &&
    `border: 1px solid var(--hl-sm);
     border-radius: var(--radius-sm);
     li:last-of-type {border-bottom:none;};
    `}
`;

export const ListGroup: FunctionComponent<Props> = ({ children, bordered }) => {
  return <StyledListGroup bordered={bordered}>{children}</StyledListGroup>;
};
