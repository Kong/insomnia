// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';

type Props = {
  type: 'request' | 'response',
};

const BlankPane = ({ type }: Props) => (
  <Pane type={type}>
    <PaneHeader />
    <PaneBody placeholder />
  </Pane>
);

export default BlankPane;
