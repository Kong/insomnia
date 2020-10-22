// @flow
import React from 'react';
import styled from 'styled-components';
import type { ProtoFile } from '../../../models/proto-file';
import PromptButton from '../base/prompt-button';
import type { DeleteProtoFileHandler, SelectProtoFileHandler } from './proto-file-list';
import { ListGroupItem } from '../../../../../insomnia-components';

type Props = {
  protoFile: ProtoFile,
  isSelected?: boolean,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
};

const SelectableListItem: React.PureComponent<{ isSelected?: boolean }> = styled(ListGroupItem)`
  &:hover {
    background-color: var(--hl-sm) !important;
  }

  background-color: ${({ isSelected }) => isSelected && 'var(--hl-sm) !important'};
`;

const ProtoFileListItem = ({ protoFile, isSelected, handleSelect, handleDelete }: Props) => {
  const { name, _id } = protoFile;

  // Don't re-instantiate the callbacks if the dependencies have not changed
  const handleSelectCallback = React.useCallback(() => handleSelect(_id), [handleSelect, _id]);
  const handleDeleteCallback = React.useCallback(
    async (e: SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await handleDelete(_id);
    },
    [handleDelete, _id],
  );

  return (
    <SelectableListItem isSelected={isSelected} onClick={handleSelectCallback}>
      <div className="row-spaced">
        {name}
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
