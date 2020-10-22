// @flow
import * as React from 'react';
import styled from 'styled-components';
import type { ProtoFile } from '../../../models/proto-file';
import PromptButton from '../base/prompt-button';
import type {
  DeleteProtoFileHandler,
  RenameProtoFileHandler,
  SelectProtoFileHandler,
} from './proto-file-list';
import { ListGroupItem } from '../../../../../insomnia-components';
import Editable from '../base/editable';

type Props = {
  protoFile: ProtoFile,
  isSelected?: boolean,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
  handleRename: RenameProtoFileHandler,
};

const SelectableListItem: React.PureComponent<{ isSelected?: boolean }> = styled(ListGroupItem)`
  &:hover {
    background-color: var(--hl-sm) !important;
  }

  background-color: ${({ isSelected }) => isSelected && 'var(--hl-sm) !important'};
`;

const ProtoFileListItem = ({
  protoFile,
  isSelected,
  handleSelect,
  handleDelete,
  handleRename,
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

  return (
    <SelectableListItem isSelected={isSelected} onClick={handleSelectCallback}>
      <div className="row-spaced">
        <Editable onSubmit={handleRenameCallback} value={name} preventBlank />
        <PromptButton
          className="btn btn--super-compact btn--outlined"
          addIcon
          confirmMessage=""
          onClick={handleDeleteCallback}
          title="Delete Proto File">
          <i className="fa fa-trash-o" />
        </PromptButton>
      </div>
    </SelectableListItem>
  );
};

export default ProtoFileListItem;
