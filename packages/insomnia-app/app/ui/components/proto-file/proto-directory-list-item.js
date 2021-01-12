// @flow
import * as React from 'react';
import { AsyncButton, Button } from 'insomnia-components';
import ProtoListItem from './proto-list-item';
import type { ProtoDirectory } from '../../../models/proto-directory';

type Props = {
  dir: ProtoDirectory,
  indentLevel: number,
};

const spinner = <i className="fa fa-spin fa-refresh" />;

const ProtoDirectoryListItem = ({ dir, indentLevel }: Props) => (
  <ProtoListItem indentLevel={indentLevel}>
    {dir.name}
    {indentLevel === 0 && (
      <div className="row">
        <AsyncButton
          variant="text"
          title="Re-upload Proto File"
          // onClick={handleUpdateCallback}
          loadingNode={spinner}
          className="space-right">
          <i className="fa fa-upload" />
        </AsyncButton>
        <Button
          variant="text"
          title="Delete Proto File"
          // onClick={handleDeleteCallback}
          bg="danger">
          <i className="fa fa-trash-o" />
        </Button>
      </div>
    )}
  </ProtoListItem>
);

export default ProtoDirectoryListItem;
