import styled from 'styled-components';
import { ReactNode } from 'react';

/***********/
/* <table> *
/***********/
export interface TableProps {
  children: ReactNode;
  striped?: boolean;
  outlined?: boolean;
  compact?: boolean;
  headings?: ReactNode[];
}

export const Table = styled.table<TableProps>`
  width: 100%;
  border-spacing: 0;
  border-collapse: collapse;

  td,
  th {
    padding: ${({ compact }) => (compact ? 'var(--padding-xs)' : 'var(--padding-sm)')}
      ${({ compact }) => (compact ? 'var(--padding-sm)' : 'var(--padding-md)')};
  }

  ${({ striped }) =>
    striped &&
    `
  tbody tr:nth-child(odd) {
    background: var(--hl-xs);
  }`}

  ${({ outlined }) =>
    outlined &&
    `
  & {
    th {
      background: var(--hl-xxs);
    }

    &,
    td {
      border: 1px solid var(--hl-sm);
    }

    tr.table--no-outline-row td {
      border-left: 0;
      border-right: 0;
    }

    & {
      border-radius: 3px;
      border-collapse: unset;
    }

    td {
      border-left: 0;
      border-bottom: 0;

      &:last-child {
        border-right: 0;
      }
    }
  }`}
`;

/********/
/* <tr> */
/********/
export const TableRow = styled.tr``;

/********/
/* <td> */
/********/
export interface TableDataProps {
  compact?: boolean;
  align?: 'center' | 'left';
}

export const TableData = styled.td<TableDataProps>`
  vertical-align: top;
  padding: 0 var(--padding-md);
  text-align: ${({ align }) => align || 'left'};
`;

/********/

/* <th> */

/********/
export interface TableHeaderProps {
  compact?: boolean;
  align?: 'center' | 'left';
}

export const TableHeader = styled.th<TableHeaderProps>`
  vertical-align: top;
  padding: 0 var(--padding-md);
  text-align: ${({ align }) => align || 'left'};
`;

/***********/
/* <thead> */
/***********/
export const TableHead = styled.thead``;

/***********/

/* <tbody> */

/***********/
export const TableBody = styled.tbody``;
