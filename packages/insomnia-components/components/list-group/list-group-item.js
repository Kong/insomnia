// @flow
import * as React from 'react';
import styled, { css } from 'styled-components';

type Props = {
  bordered?: boolean,
  isSelected?: boolean,
  selectable?: boolean,
  indentLevel?: number,
};

const ListGroupItem: React.AbstractComponent<Props> = styled.li`
  padding: var(--padding-sm) var(--padding-sm);

  ${({ bordered = true }) =>
    bordered &&
    css`
      border-bottom: 1px solid var(--hl-xs);
    `}

  ${({ selectable }) =>
    selectable &&
    css`
      &:hover {
        background-color: var(--hl-sm) !important;
      }
    `}

  ${({ isSelected }) =>
    isSelected &&
    css`
      background-color: var(--hl-xs) !important;
      font-weight: bold;
    `}

  ${({ indentLevel }) =>
    indentLevel &&
    css`
      padding-left: calc(var(--padding-sm) + var(--padding-md) * ${indentLevel});
    `};
`;

export default ListGroupItem;
