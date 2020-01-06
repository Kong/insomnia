// @flow
import * as React from 'react';
import SvgIcon from './svg-icon';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow } from './table';
import styled from 'styled-components';

export default { title: 'SvgIcon' };

const Wrapper = styled.div`
  font-size: 1.5rem;
  & > * {
    margin-right: 0.5rem;
  }
`;
Wrapper.displayName = '...';

export const _default = () => <SvgIcon icon="arrow-right" />;

export const reference = () => (
  <React.Fragment>
    <Table striped outlined>
      <TableHead>
        <TableRow>
          <TableHeader>Icon</TableHeader>
          <TableHeader>1rem</TableHeader>
          <TableHeader>1.5rem</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {Object.keys(SvgIcon.icns)
          .sort()
          .map(name => (
            <TableRow>
              <TableData>
                <code>{name}</code>
              </TableData>
              <TableData style={{ fontSize: '1rem' }}>
                <SvgIcon icon={name} />
              </TableData>
              <TableData style={{ fontSize: '1.5rem' }}>
                <SvgIcon icon={name} />
              </TableData>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  </React.Fragment>
);
