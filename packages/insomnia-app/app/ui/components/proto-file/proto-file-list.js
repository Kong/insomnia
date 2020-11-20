// @flow
import * as React from 'react';
import type { ProtoFile } from '../../../models/proto-file';
import { ListGroup, ListGroupItem } from 'insomnia-components';
import ProtoFileListItem from './proto-file-list-item';

export type SelectProtoFileHandler = (id: string) => void;
export type DeleteProtoFileHandler = (protofile: ProtoFile) => Promise<void>;
export type UpdateProtoFileHandler = (protofile: ProtoFile) => Promise<void>;
export type RenameProtoFileHandler = (protoFile: ProtoFile, name: string) => Promise<void>;

type Props = {
  protoFiles: Array<ProtoFile>,
  selectedId?: string,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
  handleRename: RenameProtoFileHandler,
  handleUpdate: UpdateProtoFileHandler,
};

const ProtoFileList = ({
  protoFiles,
  selectedId,
  handleSelect,
  handleDelete,
  handleRename,
  handleUpdate,
}: Props) => (
  <ListGroup bordered>
    {!protoFiles.length && <ListGroupItem>No proto files exist for this workspace</ListGroupItem>}
    {protoFiles.map(p => (
      <ProtoFileListItem
        key={p._id}
        protoFile={p}
        isSelected={p._id === selectedId}
        handleSelect={handleSelect}
        handleDelete={handleDelete}
        handleRename={handleRename}
        handleUpdate={handleUpdate}
      />
    ))}
  </ListGroup>
);

export default ProtoFileList;
