// @flow
import * as React from 'react';
import { AsyncButton, Button } from 'insomnia-components';
import ProtoListItem from './proto-list-item';
import type { ProtoDirectory } from '../../../models/proto-directory';
import type { DeleteProtoDirectoryHandler } from './proto-file-list';

type Props = {
  dir: ProtoDirectory,
  indentLevel: number,
  handleDeleteDirectory: DeleteProtoDirectoryHandler,
};

const spinner = <i className="fa fa-spin fa-refresh" />;

const ProtoDirectoryListItem = ({ dir, indentLevel, handleDeleteDirectory }: Props) => {
  const handleDeleteCallback = React.useCallback(
    async (e: SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await handleDeleteDirectory(dir);
    },
    [handleDeleteDirectory, dir],
  );

  return (
    <ProtoListItem indentLevel={indentLevel}>
      {dir.name}
      {indentLevel === 0 && (
        <div className="row">
          <AsyncButton
            variant="text"
            title="Re-upload Proto File"
            disabled
            // onClick={handleUpdateCallback}
            loadingNode={spinner}
            className="space-right">
            <i className="fa fa-upload" />
          </AsyncButton>
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
