// @flow
import styled from 'styled-components';
import * as React from 'react';

/***********/
/* <table> */
/***********/

type TableProps = {
  children: React.Node,
  striped?: boolean,
  outlined?: boolean,
  compact?: boolean,
  headings?: Array<React.Node>,
};

const TableStyled: React.ComponentType<{}> = styled.table`
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
const Table = (props: TableProps) => <TableStyled {...props} />;

/********/
/* <tr> */
/********/

const TableRowStyled: React.ComponentType<{}> = styled.tr``;
const TableRow = (props: {}) => <TableRowStyled {...props} />;

/********/
/* <td> */
/********/

type TableDataProps = {
  compact?: boolean,
  align?: 'center' | 'left',
};
const TableDataStyled: React.ComponentType<{
  compact?: boolean,
  align?: 'center' | 'left',
}> = styled.td`
  vertical-align: top;
  padding: 0 var(--padding-md);
  text-align: ${({ align }) => align || 'left'};
`;
const TableData = (props: TableDataProps) => <TableDataStyled {...props} />;

/********/
/* <th> */
/********/
type TableHeaderProps = {
  compact?: boolean,
  align?: 'center' | 'left',
};
const TableHeaderStyled: React.ComponentType<TableHeaderProps> = styled.th`
  vertical-align: top;
  padding: 0 var(--padding-md);
  text-align: ${({ align }) => align || 'left'};
`;
const TableHeader = (props: TableHeaderProps) => <TableHeaderStyled {...props} />;

/***********/
/* <thead> */
/***********/

const TableHeadStyled: React.ComponentType<{}> = styled.thead``;
const TableHead = (props: {}) => <TableHeadStyled {...props} />;

/***********/
/* <tbody> */
/***********/

const TableBodyStyled: React.ComponentType<{}> = styled.tbody``;
const TableBody = (props: {}) => <TableBodyStyled {...props} />;

export { Table, TableBody, TableHead, TableHeader, TableRow, TableData };
