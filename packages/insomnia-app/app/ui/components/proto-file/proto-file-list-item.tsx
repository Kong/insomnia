import { AsyncButton, Button } from 'insomnia-components';
import React, { FunctionComponent, useCallback } from 'react';

import type { ProtoFile } from '../../../models/proto-file';
import { Editable } from '../base/editable';
import type {
  DeleteProtoFileHandler,
  RenameProtoFileHandler,
  SelectProtoFileHandler,
  UpdateProtoFileHandler,
} from './proto-file-list';
import { ProtoListItem } from './proto-list-item';

interface Props {
  protoFile: ProtoFile;
  isSelected?: boolean;
  handleSelect: SelectProtoFileHandler;
  indentLevel: number;
  handleDelete: DeleteProtoFileHandler;
  handleRename: RenameProtoFileHandler;
  handleUpdate: UpdateProtoFileHandler;
}

const spinner = <i className="fa fa-spin fa-refresh" />;

export const ProtoFileListItem: FunctionComponent<Props> = ({
  protoFile,
  isSelected,
  handleSelect,
  handleDelete,
  handleRename,
  handleUpdate,
  indentLevel,
}) => {
  const { name, _id } = protoFile;
  // Don't re-instantiate the callbacks if the dependencies have not changed
  const handleSelectCallback = useCallback(() => handleSelect(_id), [handleSelect, _id]);
  const handleDeleteCallback = useCallback(
    async (e: React.SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await handleDelete(protoFile);
    },
    [handleDelete, protoFile],
  );
  const handleRenameCallback = useCallback(
    async (newName: string) => {
      await handleRename(protoFile, newName);
    },
    [handleRename, protoFile],
  );
  const handleUpdateCallback = useCallback(
    async (e: React.SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await handleUpdate(protoFile);
    },
    [handleUpdate, protoFile],
  );
  const isReadOnly = indentLevel > 0;
  return (
    <ProtoListItem
      selectable
      isSelected={isSelected}
      onClick={handleSelectCallback}
      indentLevel={indentLevel}
    >
      {isReadOnly && (
        <span className="wide">
          <i className="fa fa-file-o pad-right-sm" />
          {name}
        </span>
      )}
      {!isReadOnly && (
        <>
          <span className="wide">
            <i className="fa fa-file-o pad-right-sm" />
            <Editable className="wide" onSubmit={handleRenameCallback} value={name} preventBlank />
          </span>
          <div className="row">
            <AsyncButton
              variant="text"
              title="Re-upload Proto File"
              onClick={handleUpdateCallback}
              loadingNode={spinner}
              className="space-right"
            >
              <i className="fa fa-upload" />
            </AsyncButton>
            <Button
              variant="text"
              title="Delete Proto File"
              bg="danger"
              onClick={handleDeleteCallback}
            >
              <i className="fa fa-trash-o" />
            </Button>
          </div>
        </>
      )}
    </ProtoListItem>
  );
};
