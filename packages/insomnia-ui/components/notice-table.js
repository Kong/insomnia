// @flow
import * as React from 'react';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow } from './table';
import Button from './button';
import styled from 'styled-components';
import IcnErr from '../assets/icn-errors.svg';
import IcnWarn from '../assets/icn-warning.svg';
import IcnChvDown from '../assets/icn-chevron-down.svg';
import IcnChvUp from '../assets/icn-chevron-up.svg';
import IcnArrowRight from '../assets/icn-arrow-right.svg';

type Notice = {|
  type: 'warning' | 'error',
  line: number,
  message: string,
|};

type Props = {
  notices: Array<Notice>,

  // Optional
  onClick?: (n: Notice, e: SyntheticEvent<HTMLElement>) => any,
  compact?: boolean,
  className?: string,
};

type State = {
  collapsed: boolean,
};

const icons = {
  warning: <IcnWarn />,
  error: <IcnErr />,
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
  width: 2rem;
  left: -1.5rem;
  padding: 0;
  height: 100%;
  display: none;
  position: absolute;

  svg {
    display: block;
    width: 0.8rem;
    height: 0.8rem;
    margin: auto;
  }

  &:not(:hover) svg {
    fill: var(--hl);
  }

  &:active svg {
    fill: var(--color-font);
  }

  tr:hover & {
    display: block;
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
    align-items: center;

    svg {
      margin-right: 0.3rem;
    }
  }
`;

class NoticeTable extends React.PureComponent<Props, State> {
  state = {
    collapsed: false,
  };

  collapse(e: SyntheticEvent<HTMLButtonElement>) {
    this.setState(state => ({ collapsed: !state.collapsed }));
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

    const caret = collapsed ? <IcnChvUp /> : <IcnChvDown />;

    const errors = notices.filter(n => n.type === 'error');
    const warnings = notices.filter(n => n.type === 'warning');

    return (
      <Wrapper>
        <Header>
          <div>
            {errors.length > 0 && (
              <ErrorCount>{icons.error} {errors.length}</ErrorCount>
            )}
            {warnings.length > 0 && (
              <ErrorCount>{icons.warning} {warnings.length}</ErrorCount>
            )}
          </div>
          <Button onClick={this.collapse.bind(this)} noOutline>
            {collapsed ? 'Show' : 'Hide'} Details&nbsp;{caret}
          </Button>
        </Header>
        {!collapsed && (
          <Table striped compact={compact}>
            <TableHead>
              <TableRow>
                <TableHeader align="center">Type</TableHeader>
                <TableHeader style={{ minWidth: '4rem' }} align="center">Line</TableHeader>
                <TableHeader style={{ width: '100%' }} align="left">Message</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notices.map((n, i) => (
                <TableRow key={`${n.line}:${n.type}:${n.message}`}>
                  <TableData align="center">{icons[n.type]}</TableData>
                  <TableData align="center">{n.line}</TableData>
                  <TableData align="left">
                    <JumpButton onClick={this.onClick.bind(this, n)}>
                      <IcnArrowRight />
                    </JumpButton>
                    {n.message}
                  </TableData>
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
