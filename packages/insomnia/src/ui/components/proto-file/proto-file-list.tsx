import React, { FunctionComponent } from 'react';

import { ProtoDirectory } from '../../../models/proto-directory';
import type { ProtoFile } from '../../../models/proto-file';
import type { ExpandedProtoDirectory } from '../../redux/proto-selectors';
import { ListGroup, ListGroupItem } from '../list-group';
import { ProtoDirectoryListItem } from './proto-directory-list-item';
import { ProtoFileListItem } from './proto-file-list-item';

export type SelectProtoFileHandler = (id: string) => void;
export type DeleteProtoFileHandler = (protofile: ProtoFile) => void;
export type DeleteProtoDirectoryHandler = (protoDirectory: ProtoDirectory) => void;
export type UpdateProtoFileHandler = (protofile: ProtoFile) => Promise<void>;
export type RenameProtoFileHandler = (protoFile: ProtoFile, name?: string) => Promise<void>;

interface Props {
  protoDirectories: ExpandedProtoDirectory[];
  selectedId?: string;
  handleSelect: SelectProtoFileHandler;
  handleDelete: DeleteProtoFileHandler;
  handleUpdate: UpdateProtoFileHandler;
  handleDeleteDirectory: DeleteProtoDirectoryHandler;
}

const recursiveRender = (
  { dir, files, subDirs }: ExpandedProtoDirectory,
  props: Props,
  indent: number,
): React.ReactNode => {
  const {
    handleDelete,
    handleDeleteDirectory,
    handleSelect,
    handleUpdate,
    selectedId,
  } = props;
  const dirNode = dir && (
    <ProtoDirectoryListItem
      key={dir.name}
      dir={dir}
      indentLevel={indent++}
      handleDeleteDirectory={handleDeleteDirectory}
    />
  );
  const fileNodes = files.map(f => (
    <ProtoFileListItem
      key={f._id}
      protoFile={f}
      isSelected={f._id === selectedId}
      handleSelect={handleSelect}
      handleDelete={handleDelete}
      handleUpdate={handleUpdate}
      indentLevel={indent}
    />
  ));
  const subDirNodes = subDirs.map(sd => recursiveRender(sd, props, indent));
  return [dirNode, ...fileNodes, ...subDirNodes];
};

export const ProtoFileList: FunctionComponent<Props> = props => (
  <ListGroup bordered>
    {!props.protoDirectories.length && (
      <ListGroupItem>No proto files exist for this workspace</ListGroupItem>
    )}
    {props.protoDirectories.map(dir => recursiveRender(dir, props, 0))}
  </ListGroup>
);
