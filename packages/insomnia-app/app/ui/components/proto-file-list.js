// @flow
import React from 'react';
import type { ProtoFile } from '../../models/proto-file';
import styled from 'styled-components';
import { ListGroup, ListGroupItem } from 'insomnia-components';
import PromptButton from './base/prompt-button';

type SelectProtoFileHandler = (id: string) => void;
type DeleteProtoFileHandler = (id: string) => Promise<void>;

type Props = {
  protoFiles: Array<ProtoFile>,
  selectedId?: string,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
};

const SelectableListItem: React.PureComponent<{ isSelected?: boolean }> = styled(ListGroupItem)`
  &:hover {
    background-color: var(--hl-sm) !important;
  }

  background-color: ${({ isSelected }) => isSelected && 'var(--hl-sm) !important'};
`;

const ProtoFileListItem = (props: {
  protoFile: ProtoFile,
  isSelected?: boolean,
  handleSelect: SelectProtoFileHandler,
  handleDelete: DeleteProtoFileHandler,
}) => {
  const { protoFile, isSelected, handleSelect, handleDelete } = props;
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

const ProtoFileList = ({ protoFiles, selectedId, handleSelect, handleDelete }: Props) => (
  <ListGroup>
    {!protoFiles.length && <ListGroupItem>No proto files exist for this workspace</ListGroupItem>}
    {protoFiles.map(p => (
      <ProtoFileListItem
        key={p.id}
        protoFile={p}
        isSelected={p._id === selectedId}
        handleSelect={handleSelect}
        handleDelete={handleDelete}
      />
    ))}
  </ListGroup>
);

export default ProtoFileList;
