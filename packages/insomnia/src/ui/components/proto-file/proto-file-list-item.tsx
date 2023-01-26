import React, { FunctionComponent, useCallback } from 'react';

import type { ProtoFile } from '../../../models/proto-file';
import { AsyncButton, Button } from '../themed-button';
import type {
  DeleteProtoFileHandler,
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
  handleUpdate: UpdateProtoFileHandler;
}

const spinner = <i className="fa fa-spin fa-refresh" />;

export const ProtoFileListItem: FunctionComponent<Props> = ({
  protoFile,
  isSelected,
  handleSelect,
  handleDelete,
  handleUpdate,
  indentLevel,
}) => {
  const { name, _id } = protoFile;
  // Don't re-instantiate the callbacks if the dependencies have not changed
  const handleSelectCallback = useCallback(() => handleSelect(_id), [handleSelect, _id]);
  const handleDeleteCallback = useCallback(
    async (event: React.SyntheticEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      await handleDelete(protoFile);
    },
    [handleDelete, protoFile],
  );

  const handleUpdateCallback = useCallback(
    async (event: React.SyntheticEvent<HTMLButtonElement>) => {
      event.stopPropagation();
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
            {name}
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
