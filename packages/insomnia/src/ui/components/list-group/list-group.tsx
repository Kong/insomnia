import { ReactNode } from 'react';
import styled from 'styled-components';

export interface ListGroupProps {
  children?: ReactNode;
  bordered?: boolean;
}

export const ListGroup = styled.ul<ListGroupProps>`
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
