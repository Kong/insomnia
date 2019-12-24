// @flow
import * as React from 'react';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow } from './table';

export default { title: 'Table' };

export const _default = () => (
  <Table headings={['Column 1', 'Column 2', 'Column 3']}>
    <TableHead>
      <TableRow>
        <TableHeader>Col 1</TableHeader>
        <TableHeader>Col 2</TableHeader>
        <TableHeader>Col 3</TableHeader>
      </TableRow>
    </TableHead>
    <TableBody>
      {[1, 2, 3].map(i => (
        <TableRow key={i}>
          <TableData>Column 1</TableData>
          <TableData>Column 2</TableData>
          <TableData>Column 3</TableData>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const striped = () => (
  <Table striped headings={['Column 1', 'Column 2', 'Column 3']}>
    <TableHead>
      <TableRow>
        <TableHeader>Col 1</TableHeader>
        <TableHeader>Col 2</TableHeader>
        <TableHeader>Col 3</TableHeader>
      </TableRow>
    </TableHead>
    <TableBody>
      {[1, 2, 3].map(i => (
        <TableRow key={i}>
          <TableData>Column 1</TableData>
          <TableData>Column 2</TableData>
          <TableData>Column 3</TableData>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const stripedAndOutlined = () => (
  <Table striped outlined headings={['Column 1', 'Column 2', 'Column 3']}>
    <TableHead>
      <TableRow>
        <TableHeader>Col 1</TableHeader>
        <TableHeader>Col 2</TableHeader>
        <TableHeader>Col 3</TableHeader>
      </TableRow>
    </TableHead>
    <TableBody>
      {[1, 2, 3].map(i => (
        <TableRow key={i}>
          <TableData>Column 1</TableData>
          <TableData>Column 2</TableData>
          <TableData>Column 3</TableData>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const compactAndOutlined = () => (
  <Table outlined compact>
    <TableHead>
      <TableRow>
        <TableHeader>Col 1</TableHeader>
        <TableHeader>Col 2</TableHeader>
        <TableHeader>Col 3</TableHeader>
      </TableRow>
    </TableHead>
    <TableBody>
      {[1, 2, 3].map(i => (
        <TableRow key={i}>
          <TableData>Column 1</TableData>
          <TableData>Column 2</TableData>
          <TableData>Column 3</TableData>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
