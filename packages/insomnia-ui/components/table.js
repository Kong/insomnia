// @flow
import styled from 'styled-components';
import * as React from 'react';

type Props = {
  children: React.Node,
  striped?: boolean,
  outlined?: boolean,
  headings?: Array<React.Node>,
};

const Table: React.ComponentType<Props> = styled.table`
  width: 100%;
  border-spacing: 0;
  border-collapse: collapse;

  td, th {
    line-height: var(--line-height-${({compact}) => compact ? 'xs' : 'sm'});
  }

  ${({ striped }) => striped && `
  tbody tr:nth-child(odd) {
    background: var(--hl-xs);
  }`}

  ${({ outlined }) => outlined && `
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

const TableRow: React.ComponentType<{className?: string}> = styled.tr``;

const TableData: React.ComponentType<{compact?: boolean, align?: 'center' | 'left'}> = styled.td`
  vertical-align: top;
  padding: 0 var(--padding-md);
  text-align: ${({ align }) => align || 'left'};
`;

const TableHeader: React.ComponentType<{compact?: boolean, align?: 'center' | 'left'}> = styled.th`
  vertical-align: top;
  padding: 0 var(--padding-md);
  line-height: var(--line-height-${({ compact }) => compact ? 'xs' : 'sm'});
  text-align: ${({ align }) => align || 'left'};
`;

const TableHead: React.ComponentType<{}> = styled.thead`
  padding: 0 var(--padding-md);
  line-height: var(--line-height-sm);
  vertical-align: top;
  text-align: left;
`;

const TableBody: React.ComponentType<{}> = styled.tbody``;

export {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableData,
};
