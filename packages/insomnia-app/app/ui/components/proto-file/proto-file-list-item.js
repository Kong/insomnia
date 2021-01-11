// @flow
import * as React from 'react';
import styled, { css } from 'styled-components';
import type { ProtoFile } from '../../../models/proto-file';
import type {
  DeleteProtoFileHandler,
  RenameProtoFileHandler,
  SelectProtoFileHandler,
  UpdateProtoFileHandler,
} from './proto-file-list';
import { ListGroupItem, Button, AsyncButton } from 'insomnia-components';
import Editable from '../base/editable';

type Props = {
  protoFile: ProtoFile,
  isSelected?: boolean,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
  handleRename: RenameProtoFileHandler,
  handleUpdate: UpdateProtoFileHandler,
  indentLevel: number,
};

const spinner = <i className="fa fa-spin fa-refresh" />;

export const Indent: React.PureComponent<{ level: number }> = styled.div`
  ${({ level }) =>
    css`
      padding-left: calc(var(--padding-md) * ${level});
    `};
`;

const SelectableListItem: React.PureComponent<{ isSelected?: boolean }> = styled(ListGroupItem)`
  &:hover {
    background-color: var(--hl-sm) !important;
  }
  background-color: ${({ isSelected }) =>
    isSelected && 'var(--hl-xs) !important; font-weight: bold;'};

  i.fa {
    font-size: var(--font-size-lg);
  }
`;

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

  return (
    <SelectableListItem isSelected={isSelected} onClick={handleSelectCallback}>
      <Indent level={indentLevel} className="row-spaced">
        <Editable className="wide" onSubmit={handleRenameCallback} value={name} preventBlank />
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
      </Indent>
    </SelectableListItem>
  );
};

export default ProtoFileListItem;
