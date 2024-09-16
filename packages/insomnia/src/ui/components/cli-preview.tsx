import React from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import type { WorkspaceLoaderData } from '../routes/workspace';
import { CopyButton } from './base/copy-button';
import { CodeEditor } from './codemirror/code-editor';
export const CLIPreview = () => {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { activeEnvironment, activeWorkspaceMeta } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const isGitSyncCollection = activeWorkspaceMeta?.gitRepositoryId;
  const cliCommand = `inso run collection ${workspaceId.slice(0, 10)} -e ${activeEnvironment._id.slice(0, 10)}`;
  const githubAction = `name: Run Insomnia Collection
on: push
jobs:
  automated-api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kong/setup-inso@v1.1.6
      - name: Run API tests
        run: ${cliCommand}
`;
  return (
    <div className="h-full w-full text-md flex-row p-2">
      <div className='mb-2'>Copy this command to run your collection in the terminal</div>
      <div className="max-h-32 flex flex-col overflow-y-auto min-h-[2em] bg-[--hl-xs] px-2 py-1 m-3 border border-solid border-[--hl-sm]">
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
      {isGitSyncCollection && (
        <>
          <span>As Github Action in a git sync repo</span>
          <div className='flex-1 h-full'>
            <CodeEditor
              id="github-action-preview"
              key={cliCommand}
              mode="text/yaml"
              defaultValue={githubAction}
              readOnly
            />
          </div>
        </>)}
    </div>
  );
};
