import React, { Fragment } from 'react';
import { text, withKnobs } from '@storybook/addon-knobs';
import { SvgIcon, IconEnum, IconId } from './svg-icon';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow } from './table';
import styled from 'styled-components';

export default {
  title: 'Iconography | Core Icons',
  decorators: [withKnobs],
};

const Wrapper = styled.div`
  font-size: 1.5rem;
  & > * {
    margin-right: 0.5rem;
  }
`;

Wrapper.displayName = '...';

export const _default = () => <SvgIcon icon={IconEnum.arrowRight} />;

export const labelled = () => (
  <SvgIcon icon={IconEnum.warning} label={text('Label', '3 Warnings')} />
);

export const reference = () => (
  <Fragment>
    <Table striped outlined>
      <TableHead>
        <TableRow>
          <TableHeader>Icon</TableHeader>
          <TableHeader>1rem</TableHeader>
          <TableHeader>1.5rem</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {(Object.keys(SvgIcon.icons) as IconId[])
          .sort()
          .map(name => (
            <TableRow key={name}>
              <TableData>
                <code>{name}</code>
              </TableData>
              <TableData
                style={{
                  fontSize: '1rem',
                }}>
                <SvgIcon icon={name} />
              </TableData>
              <TableData
                style={{
                  fontSize: '1.5rem',
                }}>
                <SvgIcon icon={name} />
              </TableData>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  </Fragment>
);
