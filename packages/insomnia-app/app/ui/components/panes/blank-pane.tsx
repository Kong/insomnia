import React, { FunctionComponent } from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';

interface Props {
  type: 'request' | 'response';
}

const BlankPane: FunctionComponent<Props> = ({ type }) => (
  <Pane type={type}>
    <PaneHeader />
    <PaneBody placeholder />
  </Pane>
);

export default BlankPane;
