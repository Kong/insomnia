// @flow
import * as React from 'react';
import type { ProtoFile } from '../../../models/proto-file';
import type {
  DeleteProtoFileHandler,
  RenameProtoFileHandler,
  SelectProtoFileHandler,
  UpdateProtoFileHandler,
} from './proto-file-list';
import { Button, AsyncButton } from 'insomnia-components';
import Editable from '../base/editable';
import ProtoListItem from './proto-list-item';

type Props = {
  protoFile: ProtoFile,
  isSelected?: boolean,
  handleSelect: SelectProtoFileHandler,
  indentLevel: number,
  handleDelete: DeleteProtoFileHandler,
  handleRename: RenameProtoFileHandler,
  handleUpdate: UpdateProtoFileHandler,
};

const spinner = <i className="fa fa-spin fa-refresh" />;

const ProtoFileListItem = ({
  protoFile,
  isSelected,
  handleSelect,
  handleDelete,
  handleRename,
  handleUpdate,
  indentLevel,
}: Props) => {
  const { name, _id } = protoFile;

  // Don't re-instantiate the callbacks if the dependencies have not changed
  const handleSelectCallback = React.useCallback(() => handleSelect(_id), [handleSelect, _id]);
  const handleDeleteCallback = React.useCallback(
    async (e: SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await handleDelete(protoFile);
    },
    [handleDelete, protoFile],
  );
  const handleRenameCallback = React.useCallback(
    async (newName: string) => {
      await handleRename(protoFile, newName);
    },
    [handleRename, protoFile],
  );

  const handleUpdateCallback = React.useCallback(
    async (e: SyntheticEvent<HTMLButtonElement>) => {
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
      indentLevel={indentLevel}>
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
              className="space-right">
              <i className="fa fa-upload" />
            </AsyncButton>
            <Button
              variant="text"
              title="Delete Proto File"
              bg="danger"
              onClick={handleDeleteCallback}>
              <i className="fa fa-trash-o" />
            </Button>
          </div>
        </>
      )}
    </ProtoListItem>
  );
};

export default ProtoFileListItem;
