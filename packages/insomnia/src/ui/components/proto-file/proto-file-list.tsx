import React, { type FunctionComponent } from 'react';
import { Checkbox } from 'react-aria-components';

import type { ProtoDirectory } from '../../../models/proto-directory';
import type { ProtoFile } from '../../../models/proto-file';
import { Button } from '../themed-button';

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
  handleUnselect: SelectProtoFileHandler;
  handleDelete: DeleteProtoFileHandler;
  handleUpdate: UpdateProtoFileHandler;
  handleDeleteDirectory: DeleteProtoDirectoryHandler;
}

const recursiveRender = (
  indent: number,
  { dir, files, subDirs }: ExpandedProtoDirectory,
  handleSelect: SelectProtoFileHandler,
  handleUnselect: SelectProtoFileHandler,
  handleUpdate: UpdateProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
  handleDeleteDirectory: DeleteProtoDirectoryHandler,
  selectedId?: string
): React.ReactNode => [
  dir && (
    <li
      className='row-spaced'
      style={{
        paddingLeft: `${indent * 1}rem`,
      }}
    >
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
    </li>
  ),
  ...files.map(f => (
    <li
      className='row-spaced cursor-pointer'
      key={f._id}
      onClick={() => handleSelect(f._id)}
    >
      <>
        <Checkbox
          className="py-0"
          isSelected={f._id === selectedId}
          onChange={isSelected => {
            if (isSelected) {
              handleSelect(f._id);
            } else {
              handleUnselect(f._id);
            }
          }}
        >
          {({ isSelected }) => {
            return <>
              {isSelected ?
                <i className="fa fa-square-check fa-1x h-4 mr-2" style={{ color: 'rgb(74 222 128)' }} /> :
                <i className="fa fa-square fa-1x h-4 mr-2" />
              }
            </>;
          }}
        </Checkbox>
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
    </li>
  )),
  ...subDirs.map(sd =>
    recursiveRender(
      indent + 1,
      sd,
      handleSelect,
      handleUnselect,
      handleUpdate,
      handleDelete,
      handleDeleteDirectory,
      selectedId
    )
  ),
];

export const ProtoFileList: FunctionComponent<Props> = props => (
  <ul className="divide-y divide-solid divide-[--hl]">
    {!props.protoDirectories.length && (
      <li>No proto files exist for this workspace</li>
    )}
    {props.protoDirectories.map(dir =>
      recursiveRender(
        0,
        dir,
        props.handleSelect,
        props.handleUnselect,
        props.handleUpdate,
        props.handleDelete,
        props.handleDeleteDirectory,
        props.selectedId
      )
    )}
  </ul>
);
