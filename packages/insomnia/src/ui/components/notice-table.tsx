import React, { PropsWithChildren, ReactNode, useCallback, useState } from 'react';
import styled from 'styled-components';

import { IconEnum, SvgIcon } from './svg-icon';
import { Button } from './themed-button';

export interface Notice {
  type: 'warning' | 'error';
  line: number;
  message: string;
}

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

export interface TableHeaderProps {
  compact?: boolean;
  align?: 'center' | 'left';
}

export const TableHeader = styled.th<TableHeaderProps>`
  vertical-align: top;
  padding: 0 var(--padding-md);
  text-align: ${({ align }) => align || 'left'};
`;

export const TableHead = styled.thead``;

export const TableBody = styled.tbody``;

export interface NoticeTableProps<T extends Notice> {
  notices: T[];
  onClick: (notice: T) => void;
  onVisibilityToggle?: (expanded: boolean) => any;
  compact?: boolean;
  className?: string;
}

const Wrapper = styled.div`
  width: 100%;

  td {
    position: relative;
  }

  tr:hover {
    background-color: var(--hl-sm) !important;
  }
`;

const ScrollWrapperStyled = styled.div`
  height: 100%;
  width: 100%;
  max-height: 13rem;
  overflow-y: auto;
`;

const ErrorCount = styled.div`
  margin-right: var(--padding-md);
  display: inline-flex;
  align-items: center;
`;

const JumpButton = styled.button`
  outline: 0;
  border: 0;
  ebackground: transparent;
  font-size: var(--font-size-md);
  margin: 0;
  display: none;

  position: absolute;
  top: 0;
  bottom: 0;
  right: -0.5em;
  padding-left: 0.5em;
  padding-right: 0.5em;
  z-index: 1;

  & svg {
    opacity: 0.7;
  }

  &:hover svg {
    opacity: 1;
  }

  &:active svg {
    opacity: 0.85;
  }

  tr:hover & {
    // To keep icon centered vertically
    display: flex;
    align-items: center;
  }
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  flex-grow: 0;
  justify-content: space-between;
  border: 1px solid var(--hl-sm);
  border-left: 0;
  border-right: 0;
  padding-left: var(--padding-md);
`;

const NoticeRow = <T extends Notice>({
  notice,
  onClick: propsOnClick,
}: PropsWithChildren<{
  notice: T;
  onClick:(notice: T) => void;
}>) => {
  const onClick = useCallback(() => {
    propsOnClick?.(notice);
  }, [notice, propsOnClick]);

  return (
    <TableRow key={`${notice.line}:${notice.type}:${notice.message}`}>
      <TableData align="center">
        <SvgIcon icon={notice.type} />
      </TableData>
      <TableData align="center">
        {notice.line}
        <JumpButton onClick={onClick}>
          <SvgIcon icon={IconEnum.arrowRight} />
        </JumpButton>
      </TableData>
      <TableData align="left">{notice.message}</TableData>
    </TableRow>
  );
};

export const NoticeTable = <T extends Notice>({
  notices,
  compact,
  onClick,
  onVisibilityToggle,
}: PropsWithChildren<NoticeTableProps<T>>) => {
  const [collapsed, setCollapsed] = useState(false);

  const onCollapse = useCallback(() => {
    setCollapsed(!collapsed);
    if (onVisibilityToggle) {
      onVisibilityToggle(!collapsed);
    }
  }, [onVisibilityToggle, collapsed]);

  const errors = notices.filter(notice => notice.type === 'error');
  const warnings = notices.filter(notice => notice.type === 'warning');
  return (
    <Wrapper>
      <Header>
        <div>
          {errors.length > 0 && (
            <ErrorCount>
              <SvgIcon icon={IconEnum.error} label={errors.length} />
            </ErrorCount>
          )}
          {warnings.length > 0 && (
            <ErrorCount>
              <SvgIcon icon={IconEnum.warning} label={warnings.length} />
            </ErrorCount>
          )}
        </div>
        <Button className='btn btn--compact' onClick={onCollapse}>
          {collapsed ? 'Show' : 'Hide'} Details
          <SvgIcon
            style={{ marginLeft: 'var(--padding-xs)' }}
            icon={collapsed ? IconEnum.chevronUp : IconEnum.chevronDown}
          />
        </Button>
      </Header>
      {!collapsed && (
        <ScrollWrapperStyled>
          <Table striped compact={compact}>
            <TableHead>
              <TableRow>
                <TableHeader align="center">Type</TableHeader>
                <TableHeader
                  style={{
                    minWidth: '3em',
                  }}
                  align="center"
                >
                  Line
                </TableHeader>
                <TableHeader
                  style={{
                    width: '100%',
                  }}
                  align="left"
                >
                  Message
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notices.map(notice => (
                <NoticeRow
                  key={`${notice.line}${notice.message}`}
                  notice={notice}
                  onClick={onClick}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollWrapperStyled>
      )}
    </Wrapper>
  );
};
