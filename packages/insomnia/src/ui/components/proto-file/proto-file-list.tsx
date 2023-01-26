import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import { ProtoDirectory } from '../../../models/proto-directory';
import type { ProtoFile } from '../../../models/proto-file';
import { ListGroup, ListGroupItem } from '../list-group';
import { Button } from '../themed-button';

export type SelectProtoFileHandler = (id: string) => void;
export type DeleteProtoFileHandler = (protofile: ProtoFile) => void;
export type DeleteProtoDirectoryHandler = (protoDirectory: ProtoDirectory) => void;
export type UpdateProtoFileHandler = (protofile: ProtoFile) => Promise<void>;
export type RenameProtoFileHandler = (protoFile: ProtoFile, name?: string) => Promise<void>;
export const ProtoListItem = styled(ListGroupItem).attrs(() => ({
  className: 'row-spaced',
}))`
  button i.fa {
    font-size: var(--font-size-lg);
  }

  height: var(--line-height-sm);
`;

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
  dir && (
    <ProtoListItem indentLevel={indent}>
      <span className="wide">
        <i className="fa fa-folder-open-o pad-right-sm" />
        {dir.name}
      </span>
      {indent === 0 && (
        <div className="row">
          <Button
            variant="text"
            title="Delete Directory"
            onClick={event => {
              event.stopPropagation();
              handleDeleteDirectory(dir);
            }}
            bg="danger"
          >
            <i className="fa fa-trash-o" />
          </Button>
        </div>
      )}
    </ProtoListItem>),
  ...files.map(f => (
    <ProtoListItem
      key={f._id}
      selectable
      isSelected={f._id === selectedId}
      onClick={() => handleSelect(f._id)}
      indentLevel={indent + 1}
    >
      <>
        <span className="wide">
          <i className="fa fa-file-o pad-right-sm" />
          {f.name}
        </span>
        <div className="row">
          <Button
            variant="text"
            title="Re-upload Proto File"
            onClick={event => {
              event.stopPropagation();
              handleUpdate(f);
            }}
            className="space-right"
          >
            <i className="fa fa-upload" />
          </Button>
          <Button
            variant="text"
            title="Delete Proto File"
            bg="danger"
            onClick={event => {
              event.stopPropagation();
              handleDelete(f);
            }}
          >
            <i className="fa fa-trash-o" />
          </Button>
        </div>
      </>
    </ProtoListItem>
  )),
  ...subDirs.map(sd => recursiveRender(
    indent + 1,
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
