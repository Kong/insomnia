import React, { FunctionComponent, useCallback } from 'react';
import { Button } from 'insomnia-components';
import ProtoListItem from './proto-list-item';
import type { ProtoDirectory } from '../../../models/proto-directory';
import type { DeleteProtoDirectoryHandler } from './proto-file-list';

interface Props {
  dir: ProtoDirectory;
  indentLevel: number;
  handleDeleteDirectory: DeleteProtoDirectoryHandler;
}

const ProtoDirectoryListItem: FunctionComponent<Props> = ({ dir, indentLevel, handleDeleteDirectory }) => {
  const handleDeleteCallback = useCallback(
    async (e: React.SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await handleDeleteDirectory(dir);
    },
    [handleDeleteDirectory, dir],
  );
  return (
    <ProtoListItem indentLevel={indentLevel}>
      <span className="wide">
        <i className="fa fa-folder-open-o pad-right-sm" />
        {dir.name}
      </span>
      {indentLevel === 0 && (
        <div className="row">
          <Button
            variant="text"
            title="Delete Directory"
            onClick={handleDeleteCallback}
            bg="danger">
            <i className="fa fa-trash-o" />
          </Button>
        </div>
      )}
    </ProtoListItem>
  );
};

export default ProtoDirectoryListItem;
