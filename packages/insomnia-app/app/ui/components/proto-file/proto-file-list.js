// @flow
import * as React from 'react';
import type { ProtoFile } from '../../../models/proto-file';
import { ListGroup, ListGroupItem } from 'insomnia-components';
import ProtoFileListItem from './proto-file-list-item';

export type SelectProtoFileHandler = (id: string) => void;
export type DeleteProtoFileHandler = (protofile: ProtoFile) => Promise<void>;
export type RenameProtoFileHandler = (protoFile: ProtoFile, name: string) => Promise<void>;

type Props = {
  protoFiles: Array<ProtoFile>,
  selectedId?: string,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
  handleRename: RenameProtoFileHandler,
};

const ProtoFileList = ({
  protoFiles,
  selectedId,
  handleSelect,
  handleDelete,
  handleRename,
}: Props) => (
  <ListGroup>
    {!protoFiles.length && <ListGroupItem>No proto files exist for this workspace</ListGroupItem>}
    {protoFiles.map(p => (
      <ProtoFileListItem
        key={p._id}
        protoFile={p}
        isSelected={p._id === selectedId}
        handleSelect={handleSelect}
        handleDelete={handleDelete}
        handleRename={handleRename}
      />
    ))}
  </ListGroup>
);

export default ProtoFileList;
