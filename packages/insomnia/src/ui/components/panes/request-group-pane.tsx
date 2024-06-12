import React, { FC, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { Settings } from '../../../models/settings';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { RequestGroupLoaderData } from '../../routes/request-group';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { EnvironmentEditor, EnvironmentEditorHandle } from '../editors/environment-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestScriptEditor } from '../editors/request-script-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownPreview } from '../markdown-preview';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';

export const RequestGroupPane: FC<{ settings: Settings }> = ({ settings }) => {
  const { activeRequestGroup } = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const { activeEnvironment } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const [isRequestGroupSettingsModalOpen, setIsRequestGroupSettingsModalOpen] = useState(false);
  const patchRequestGroup = useRequestGroupPatcher();
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const uniqueKey = `${activeEnvironment?.modified}::${activeRequestGroup._id}::${gitVersion}::${activeRequestSyncVersion}`;
  const folderHeaders = activeRequestGroup?.headers || [];
  const headersCount = folderHeaders.filter(h => !h.disabled)?.length || 0;
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);
  const patchGroup = useRequestGroupPatcher();

  const saveChanges = () => {
    if (environmentEditorRef.current?.isValid()) {
      try {
        const data = environmentEditorRef.current?.getValue();
        if (activeRequestGroup && data) {
          patchGroup(activeRequestGroup._id, {
            environment: data.object,
            environmentPropertyOrder: data.propertyOrder,
          });
        }
      } catch (err) {
        console.warn('Failed to update environment', err);
      }
    }
  };
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
            id='scripts'
          >
            <span>Scripts</span>
            {Boolean(activeRequestGroup.preRequestScript || activeRequestGroup.afterResponseScript) && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                <span className='w-2 h-2 bg-green-500 rounded-full' />
              </span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='environment'
          >
            Environment
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
        <TabPanel className='w-full flex-1' id='scripts'>
          <Tabs className="w-full h-full flex flex-col overflow-hidden">
            <TabList className="w-full flex-shrink-0 overflow-x-auto border-solid border-b border-b-[--hl-md] px-2 bg-[--color-bg] flex items-center gap-2 h-[--line-height-sm]" aria-label="Request scripts tabs">
              <Tab
                className="rounded-md flex-shrink-0 h-[--line-height-xxs] text-sm flex items-center justify-between cursor-pointer w-[10.5rem] outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300"
                id="pre-request"
              >
                <div className='flex flex-1 items-center gap-2'>
                  <Icon icon="arrow-right-to-bracket" />
                  <span>Pre-request</span>
                </div>
                {Boolean(activeRequestGroup.preRequestScript) && (
                  <span className="p-2 rounded-lg">
                    <span className="flex w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                )}
              </Tab>
              <Tab
                className="rounded-md flex-shrink-0 h-[--line-height-xxs] text-sm flex items-center justify-between cursor-pointer w-[10.5rem] outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300"
                id="after-response"
              >
                <div className='flex flex-1 items-center gap-2'>
                  <Icon icon="arrow-right-from-bracket" />
                  <span>After-response</span>
                </div>
                {Boolean(activeRequestGroup.afterResponseScript) && (
                  <span className="p-2 rounded-lg">
                    <span className="flex w-2 h-2 bg-green-500 rounded-full" />
                  </span>
                )}
              </Tab>
            </TabList>
            <TabPanel className="w-full flex-1" id='pre-request'>
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestScriptEditor
                  uniquenessKey={uniqueKey}
                  defaultValue={activeRequestGroup.preRequestScript || ''}
                  onChange={preRequestScript => patchRequestGroup(activeRequestGroup._id, { preRequestScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel className="w-full flex-1" id="after-response">
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestScriptEditor
                  uniquenessKey={uniqueKey}
                  defaultValue={activeRequestGroup.afterResponseScript || ''}
                  onChange={afterResponseScript => patchRequestGroup(activeRequestGroup._id, { afterResponseScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
          </Tabs>
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto ' id='environment'>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <EnvironmentEditor
              ref={environmentEditorRef}
              key={activeRequestGroup ? activeRequestGroup._id : 'n/a'}
              environmentInfo={{
                object: activeRequestGroup ? activeRequestGroup.environment : {},
                propertyOrder: activeRequestGroup && activeRequestGroup.environmentPropertyOrder,
              }}
              onBlur={saveChanges}
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
