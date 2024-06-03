import React, { FC, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { Settings } from '../../../models/settings';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { RequestGroupLoaderData } from '../../routes/request-group';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { ErrorBoundary } from '../error-boundary';
import { MarkdownPreview } from '../markdown-preview';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';

export const RequestGroupPane: FC<{ settings: Settings }> = ({ }) => {
  const { activeRequestGroup } = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const { activeEnvironment } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const [isRequestGroupSettingsModalOpen, setIsRequestGroupSettingsModalOpen] = useState(false);
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const uniqueKey = `${activeEnvironment?.modified}::${activeRequestGroup._id}::${gitVersion}::${activeRequestSyncVersion}`;
  const folderHeaders = activeRequestGroup?.headers || [];
  const headersCount = folderHeaders.filter(h => !h.disabled)?.length || 0;

  return (
    <>
      <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
        <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='auth'
          >
            Auth
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='headers'
          >
            <span>Headers</span>
            {headersCount > 0 && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                {headersCount}
              </span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='docs'
          >
            Docs
          </Tab>
        </TabList>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='auth'>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <AuthWrapper authentication={activeRequestGroup.authentication} />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto ' id='headers'>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <RequestHeadersEditor
              bulk={false}
              headers={folderHeaders}
              requestType="RequestGroup"
            />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto ' id='docs'>
          {activeRequestGroup.description ? (
            <div>
              <div className="pull-right pad bg-default">
                <button
                  className="btn btn--clicky"
                  onClick={() => setIsRequestGroupSettingsModalOpen(true)}
                >
                  Edit
                </button>
              </div>
              <div className="pad">
                <ErrorBoundary errorClassName="font-error pad text-center">
                  <MarkdownPreview
                    heading={activeRequestGroup.name}
                    markdown={activeRequestGroup.description}
                  />
                </ErrorBoundary>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden editor vertically-center text-center">
              <p className="pad text-sm text-center">
                <span className="super-faint">
                  <i
                    className="fa fa-file-text-o"
                    style={{
                      fontSize: '8rem',
                      opacity: 0.3,
                    }}
                  />
                </span>
                <br />
                <br />
                <button
                  className="btn btn--clicky faint"
                  onClick={() => setIsRequestGroupSettingsModalOpen(true)}
                >
                  Add Description
                </button>
              </p>
            </div>
          )}
        </TabPanel>
      </Tabs>
      {
        isRequestGroupSettingsModalOpen && (
          <RequestGroupSettingsModal
            requestGroup={activeRequestGroup}
            onHide={() => setIsRequestGroupSettingsModalOpen(false)}
          />
        )
      }
    </>
  );
};
