// @flow
import * as React from 'react';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow } from './table';
import Button from './button';
import styled from 'styled-components';
import SvgIcon from './svg-icon';

type Notice = {|
  type: 'warning' | 'error',
  line: number,
  message: string,
|};

type Props = {
  notices: Array<Notice>,

  // Optional
  onClick?: (n: Notice, e: SyntheticEvent<HTMLElement>) => any,
  onVisibilityToggle?: (expanded: boolean) => any,
  compact?: boolean,
  className?: string,
};

type State = {
  collapsed: boolean,
};

const Wrapper: React.ComponentType<any> = styled.div`
  width: 100%;

  td {
    position: relative;
  }

  tr:hover {
    background-color: var(--hl-sm) !important;
  }
`;

const ErrorCount: React.ComponentType<any> = styled.div`
  margin-right: var(--padding-md);
`;

const JumpButton: React.ComponentType<any> = styled.button`
  outline: 0;
  border: 0;
  background: transparent;
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

const Header: React.ComponentType<any> = styled.header`
  display: flex;
  align-items: center;
  flex-grow: 0;
  justify-content: space-between;
  border: 1px solid var(--hl-sm);
  border-left: 0;
  border-right: 0;
  padding-left: var(--padding-md);

  & > * {
    display: flex;
    align-items: stretch;

    svg {
      margin-right: 0.2rem;
    }
  }
`;

class NoticeTable extends React.PureComponent<Props, State> {
  state = {
    collapsed: false,
  };

  collapse(e: SyntheticEvent<HTMLButtonElement>) {
    const { onVisibilityToggle } = this.props;
    this.setState(
      state => ({ collapsed: !state.collapsed }),
      () => {
        if (onVisibilityToggle) {
          onVisibilityToggle(!this.state.collapsed);
        }
      },
    );
  }

  onClick(notice: Notice, e: SyntheticEvent<HTMLButtonElement>) {
    const { onClick } = this.props;
    if (!onClick) {
      return;
    }

    onClick(notice, e);
  }

  render() {
    const { notices, compact } = this.props;
    const { collapsed } = this.state;

    const caret = collapsed ? <SvgIcon icon="chevron-up" /> : <SvgIcon icon="chevron-down" />;

    const errors = notices.filter(n => n.type === 'error');
    const warnings = notices.filter(n => n.type === 'warning');

    return (
      <Wrapper>
        <Header>
          <div>
            {errors.length > 0 && (
              <ErrorCount>
                <SvgIcon icon="error" /> {errors.length}
              </ErrorCount>
            )}
            {warnings.length > 0 && (
              <ErrorCount>
                <SvgIcon icon="warning" /> {warnings.length}
              </ErrorCount>
            )}
          </div>
          <Button onClick={this.collapse.bind(this)} noOutline>
            {collapsed ? 'Show' : 'Hide'} Details{caret}
          </Button>
        </Header>
        {!collapsed && (
          <Table striped compact={compact}>
            <TableHead>
              <TableRow>
                <TableHeader align="center">Type</TableHeader>
                <TableHeader style={{ minWidth: '3em' }} align="center">
                  Line
                </TableHeader>
                <TableHeader style={{ width: '100%' }} align="left">
                  Message
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notices.map((n, i) => (
                <TableRow key={`${n.line}:${n.type}:${n.message}`}>
                  <TableData align="center">
                    <SvgIcon icon={n.type} />
                  </TableData>
                  <TableData align="center">
                    {n.line}
                    <JumpButton onClick={this.onClick.bind(this, n)}>
                      <SvgIcon icon="arrow-right" />
                    </JumpButton>
                  </TableData>
                  <TableData align="left">{n.message}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Wrapper>
    );
  }
}

export default NoticeTable;
