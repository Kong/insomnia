import React, { type FC, useRef, useState } from 'react';
import { Heading, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { type EnvironmentKvPairData, EnvironmentType, getDataFromKVPair } from '../../../models/environment';
import type { Settings } from '../../../models/settings';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import type { RequestGroupLoaderData } from '../../routes/request-group';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { EnvironmentEditor, type EnvironmentEditorHandle } from '../editors/environment-editor';
import { EnvironmentKVEditor } from '../editors/environment-key-value-editor/key-value-editor';
import { handleToggleEnvironmentType } from '../editors/environment-utils';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestScriptEditor } from '../editors/request-script-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
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

  const handleKVPairChange = (kvPairData: EnvironmentKvPairData[]) => {
    if (activeRequestGroup) {
      const environmentData = getDataFromKVPair(kvPairData);
      patchGroup(activeRequestGroup._id, {
        environment: environmentData.data,
        environmentPropertyOrder: environmentData.dataPropertyOrder,
        kvPairData,
      });
    }
  };

  const requestGroupAuth = getAuthObjectOrNull(activeRequestGroup.authentication);
  const isNoneOrInherited = requestGroupAuth?.type === 'none' || requestGroupAuth === null;

  return (
    <>
      <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
        <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='auth'
          >
            <span>Auth</span>
            {!isNoneOrInherited && (
              <span className='p-1 min-w-6 h-6 flex items-center justify-center text-xs rounded-lg border border-solid border-[--hl]'>
                <span className='w-2 h-2 bg-green-500 rounded-full' />
              </span>
            )}
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
                  uniquenessKey={`${activeRequestGroup._id}:pre-request-script`}
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
                  uniquenessKey={`${activeRequestGroup._id}:after-response-script`}
                  defaultValue={activeRequestGroup.afterResponseScript || ''}
                  onChange={afterResponseScript => patchRequestGroup(activeRequestGroup._id, { afterResponseScript })}
                  settings={settings}
                />
              </ErrorBoundary>
            </TabPanel>
          </Tabs>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='environment'>
          <div className='flex items-center justify-between gap-2 w-full overflow-hidden'>
            <Heading className='flex items-center gap-2 text-lg py-2 px-4 overflow-hidden h-[--line-height-sm]'>
              <ToggleButton
                onChange={isSelected => {
                  if (activeRequestGroup) {
                    const toggleSwitchEnvironmentType = (newEnvironmentType: EnvironmentType, kvPairData: EnvironmentKvPairData[]) => {
                      patchGroup(activeRequestGroup._id, {
                        environmentType: newEnvironmentType,
                        kvPairData: kvPairData,
                      });
                    };
                    const { environment, environmentPropertyOrder, kvPairData } = activeRequestGroup;
                    const isValidJSON = !!environmentEditorRef.current?.isValid();
                    handleToggleEnvironmentType(isSelected, { data: environment, dataPropertyOrder: environmentPropertyOrder, kvPairData }, isValidJSON, toggleSwitchEnvironmentType);
                  }
                }}
                isSelected={activeRequestGroup?.environmentType !== EnvironmentType.KVPAIR}
                className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start ml-2 pl-2 py-1 h-full rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-colors text-sm"
              >
                {({ isSelected }) => (
                  <>
                    <Icon icon={isSelected ? 'toggle-on' : 'toggle-off'} className={`${isSelected ? 'text-[--color-success]' : ''}`} />
                    <span>{
                      isSelected ? 'Table Edit' : 'Raw Edit'
                    }</span>
                  </>
                )}
              </ToggleButton>
            </Heading>
          </div>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <div className='h-[calc(100%-var(--line-height-md))] flex flex-col'>
              {activeRequestGroup && activeRequestGroup.environmentType === EnvironmentType.KVPAIR ?
                <EnvironmentKVEditor
                  key={activeRequestGroup ? activeRequestGroup._id : 'n/a'}
                  data={activeRequestGroup?.kvPairData || []}
                  onChange={handleKVPairChange}
                /> :
                <EnvironmentEditor
                  ref={environmentEditorRef}
                  key={activeRequestGroup ? activeRequestGroup._id : 'n/a'}
                  environmentInfo={{
                    object: activeRequestGroup ? activeRequestGroup.environment : {},
                    propertyOrder: activeRequestGroup && activeRequestGroup.environmentPropertyOrder,
                  }}
                  onBlur={saveChanges}
                />
              }
            </div>
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 overflow-y-auto' id='docs'>
          <MarkdownEditor
            key={uniqueKey}
            className="margin-top"
            placeholder="Write a description"
            defaultValue={activeRequestGroup.description}
            onChange={(description: string) => patchRequestGroup(activeRequestGroup._id, { description })}
          />
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
