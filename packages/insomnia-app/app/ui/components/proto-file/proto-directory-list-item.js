// @flow
import * as React from 'react';
import { ListGroupItem } from 'insomnia-components';
import { Indent } from './proto-file-list-item';
import type { ProtoDirectory } from '../../../models/proto-directory';

type Props = {
  dir: ProtoDirectory,
  indentLevel: number,
};

const ProtoDirectoryListItem = ({ dir, indentLevel }: Props) => {
  return (
    <ListGroupItem>
      <Indent level={indentLevel} className="row-spaced">
        {dir.name}
      </Indent>
    </ListGroupItem>
  );
};

export default ProtoDirectoryListItem;
