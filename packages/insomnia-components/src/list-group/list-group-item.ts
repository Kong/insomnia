import styled, { css } from 'styled-components';

interface Props {
  isSelected?: boolean;
  selectable?: boolean;
  indentLevel?: number;
}

export const ListGroupItem = styled.li<Props>`
  border-bottom: 1px solid var(--hl-xs);
  padding: var(--padding-sm) var(--padding-sm);

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
