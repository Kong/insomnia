// @flow
import * as React from 'react';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow } from './table';
import Button from './button';
import styled from 'styled-components';
import IcnErr from '../assets/icn-errors.svg';
import IcnWarn from '../assets/icn-warning.svg';
import IcnChvDown from '../assets/icn-chevron-down.svg';
import IcnChvUp from '../assets/icn-chevron-up.svg';

type Notice = {|
  type: 'warning' | 'error',
  line: number,
  message: string,
|};

type Props = {
  notices: Array<Notice>,

  // Optional
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

  render() {
    const { notices, compact } = this.props;
    const { collapsed } = this.state;

    const caret = collapsed ? <IcnChvUp /> : <IcnChvDown />;

    return (
      <Wrapper>
        <Header>
          <div>
            {icons.error} 1&nbsp;&nbsp;&nbsp;&nbsp;
            {icons.warning} 1
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
              {notices.map((j, i) => (
                <TableRow key={`${j.line}:${j.type}:${j.message}`}>
                  <TableData align="center">{icons[j.type]}</TableData>
                  <TableData align="center">{j.line}</TableData>
                  <TableData align="left">{j.message}</TableData>
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
