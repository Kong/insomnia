import React, { FunctionComponent } from 'react';

import { ProtoDirectory } from '../../../models/proto-directory';
import type { ProtoFile } from '../../../models/proto-file';
import { ListGroup, ListGroupItem } from '../list-group';
import { ProtoDirectoryListItem } from './proto-directory-list-item';
import { ProtoFileListItem } from './proto-file-list-item';

export type SelectProtoFileHandler = (id: string) => void;
export type DeleteProtoFileHandler = (protofile: ProtoFile) => void;
export type DeleteProtoDirectoryHandler = (protoDirectory: ProtoDirectory) => void;
export type UpdateProtoFileHandler = (protofile: ProtoFile) => Promise<void>;
export type RenameProtoFileHandler = (protoFile: ProtoFile, name?: string) => Promise<void>;

export interface ExpandedProtoDirectory {
  files: ProtoFile[];
  dir: ProtoDirectory | null;
  subDirs: ExpandedProtoDirectory[];
}
interface Props {
  protoDirectories: ExpandedProtoDirectory[];
  selectedId?: string;
  handleSelect: SelectProtoFileHandler;
  handleDelete: DeleteProtoFileHandler;
  handleUpdate: UpdateProtoFileHandler;
  handleDeleteDirectory: DeleteProtoDirectoryHandler;
}

const recursiveRender = (
  indent: number,
  { dir, files, subDirs }: ExpandedProtoDirectory,
  handleSelect: SelectProtoFileHandler,
  handleUpdate: UpdateProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
  handleDeleteDirectory: DeleteProtoDirectoryHandler,
  selectedId?: string,
): React.ReactNode => ([
  dir && (<ProtoDirectoryListItem
    key={dir.name}
    dir={dir}
    indentLevel={indent++}
    handleDeleteDirectory={handleDeleteDirectory}
  />),
  ...files.map(f => (
    <ProtoFileListItem
      key={f._id}
      protoFile={f}
      isSelected={f._id === selectedId}
      handleSelect={handleSelect}
      handleUpdate={handleUpdate}
      handleDelete={handleDelete}
      indentLevel={indent}
    />
  )),
  ...subDirs.map(sd => recursiveRender(
    indent,
    sd,
    handleSelect,
    handleUpdate,
    handleDelete,
    handleDeleteDirectory,
    selectedId,
  ))]);

export const ProtoFileList: FunctionComponent<Props> = props => (
  <ListGroup bordered>
    {!props.protoDirectories.length && (
      <ListGroupItem>No proto files exist for this workspace</ListGroupItem>
    )}
    {props.protoDirectories.map(dir => recursiveRender(
      0,
      dir,
      props.handleSelect,
      props.handleUpdate,
      props.handleDelete,
      props.handleDeleteDirectory,
      props.selectedId
    ))}
  </ListGroup>
);
