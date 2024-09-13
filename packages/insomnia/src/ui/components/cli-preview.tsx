import React from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import type { WorkspaceLoaderData } from '../routes/workspace';
import { CopyButton } from './base/copy-button';
export const CLIPreview = () => {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { activeEnvironment } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const cliCommand = `inso run collection ${workspaceId.slice(0, 10)} -e ${activeEnvironment._id.slice(0, 10)}`;
  return (
    <div className='pad'>
      <div className='mb-2'>Copy this command to run your collection in the terminal</div>
      <div className="max-h-32 flex flex-col overflow-y-auto min-h-[2em] bg-[--hl-xs] px-2 py-1 border border-solid border-[--hl-sm]">
        <div className="flex justify-between overflow-auto relative h-full gap-[var(--padding-sm)] w-full">
          <span>{cliCommand}</span>

          <CopyButton
            size="small"
            content={cliCommand}
            title="Copy Command"
            confirmMessage=""
            className='self-start sticky top-0'
          >
            <i className="fa fa-copy" />
          </CopyButton>
        </div>
      </div>
    </div>
  );
};
