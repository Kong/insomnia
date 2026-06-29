import type { EnvironmentKvPairData } from 'insomnia-data';
import { EnvironmentType } from 'insomnia-data';
import React, { type FC, useRef, useState } from 'react';
import { Heading, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';

import { getDataFromKVPair } from '~/common/utils/environment-utils';
import { useToggleEnvironmentType } from '~/ui/hooks/use-toggle-environment-type';

import { getAuthObjectOrNull } from '../../../network/authentication';
import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestGroupLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import { useGitVCSVersion } from '../../hooks/use-vcs-version';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { EnvironmentEditor, type EnvironmentEditorHandle } from '../editors/environment-editor';
import { EnvironmentKVEditor } from '../editors/environment-key-value-editor/key-value-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestScriptEditor } from '../editors/request-script-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';

export const RequestGroupPane: FC = () => {
  const { activeRequestGroup } = useRequestGroupLoaderData()!;
  const { activeEnvironment, vcsVersion } = useWorkspaceLoaderData()!;
  const [isRequestGroupSettingsModalOpen, setIsRequestGroupSettingsModalOpen] = useState(false);
  const patchRequestGroup = useRequestGroupPatcher();
  const gitVersion = useGitVCSVersion();
  const uniqueKey = `${activeEnvironment?.modified}::${activeRequestGroup._id}::${gitVersion}::${vcsVersion}`;
  const folderHeaders = activeRequestGroup?.headers || [];
  const headersCount = folderHeaders.filter(h => !h.disabled)?.length || 0;
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);
  const patchGroup = useRequestGroupPatcher();
  const { toggleEnvironmentType } = useToggleEnvironmentType();

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
      <Tabs
        aria-label="Request group tabs"
        className="flex h-full w-full flex-1 flex-col"
        onSelectionChange={key => {
          // Save environment changes when nav away from environment tab.
          if (key !== 'environment' && environmentEditorRef) {
            saveChanges();
          }
        }}
      >
        <TabList
          className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
          aria-label="Request pane tabs"
        >
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="auth"
          >
            <span>Auth</span>
            {!isNoneOrInherited && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="headers"
          >
            <span>Headers</span>
            {headersCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                {headersCount}
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="scripts"
          >
            <span>Scripts</span>
            {Boolean(activeRequestGroup.preRequestScript || activeRequestGroup.afterResponseScript) && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="environment"
          >
            Environment
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="docs"
          >
            Docs
          </Tab>
        </TabList>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="auth">
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <AuthWrapper authentication={activeRequestGroup.authentication} />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="headers">
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <RequestHeadersEditor bulk={false} headers={folderHeaders} requestType="RequestGroup" />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className="w-full flex-1" id="scripts">
          <Tabs className="flex h-full w-full flex-col overflow-hidden">
            <TabList
              className="flex h-(--line-height-sm) w-full shrink-0 items-center gap-2 overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg) px-2"
              aria-label="Request scripts tabs"
            >
              <Tab
                className="flex h-(--line-height-xxs) w-42 shrink-0 cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-(--color-font-surprise) aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-(--color-font-surprise)"
                id="pre-request"
              >
                <div className="flex flex-1 items-center gap-2">
                  <Icon icon="arrow-right-to-bracket" />
                  <span>Pre-request</span>
                </div>
                {Boolean(activeRequestGroup.preRequestScript) && (
                  <span className="rounded-lg p-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </Tab>
              <Tab
                className="flex h-(--line-height-xxs) w-42 shrink-0 cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-(--color-font-surprise) aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-(--color-font-surprise)"
                id="after-response"
              >
                <div className="flex flex-1 items-center gap-2">
                  <Icon icon="arrow-right-from-bracket" />
                  <span>After-response</span>
                </div>
                {Boolean(activeRequestGroup.afterResponseScript) && (
                  <span className="rounded-lg p-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </Tab>
            </TabList>
            <TabPanel className="w-full flex-1" id="pre-request">
              <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
                <RequestScriptEditor
                  uniquenessKey={`${activeRequestGroup._id}:pre-request-script`}
                  defaultValue={activeRequestGroup.preRequestScript || ''}
                  onChange={preRequestScript => patchRequestGroup(activeRequestGroup._id, { preRequestScript })}
                />
              </ErrorBoundary>
            </TabPanel>
            <TabPanel className="w-full flex-1" id="after-response">
              <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
                <RequestScriptEditor
                  uniquenessKey={`${activeRequestGroup._id}:after-response-script`}
                  defaultValue={activeRequestGroup.afterResponseScript || ''}
                  onChange={afterResponseScript => patchRequestGroup(activeRequestGroup._id, { afterResponseScript })}
                />
              </ErrorBoundary>
            </TabPanel>
          </Tabs>
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="environment">
          <div className="flex w-full items-center justify-between gap-2 overflow-hidden">
            <Heading className="flex h-(--line-height-sm) items-center gap-2 overflow-hidden px-4 py-2 text-lg">
              <ToggleButton
                onChange={isSelected => {
                  if (activeRequestGroup) {
                    const toggleSwitchEnvironmentType = (
                      newEnvironmentType: EnvironmentType,
                      kvPairData: EnvironmentKvPairData[],
                    ) => {
                      patchGroup(activeRequestGroup._id, {
                        environmentType: newEnvironmentType,
                        kvPairData: kvPairData,
                      });
                    };
                    const { environment, environmentPropertyOrder, kvPairData } = activeRequestGroup;
                    const isValidJSON = !!environmentEditorRef.current?.isValid();
                    toggleEnvironmentType(
                      isSelected,
                      { data: environment, dataPropertyOrder: environmentPropertyOrder, kvPairData },
                      isValidJSON,
                      toggleSwitchEnvironmentType,
                    );
                  }
                }}
                isSelected={activeRequestGroup?.environmentType !== EnvironmentType.KVPAIR}
                className="ml-2 flex h-full w-[14ch] shrink-0 items-center justify-start gap-2 rounded-xs py-1 pl-2 text-sm text-(--color-font) ring-1 ring-transparent transition-colors hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
              >
                {({ isSelected }) => (
                  <>
                    <Icon
                      icon={!isSelected ? 'toggle-on' : 'toggle-off'}
                      className={`${!isSelected ? 'text-(--color-success)' : ''}`}
                    />
                    <span>Table View</span>
                  </>
                )}
              </ToggleButton>
            </Heading>
          </div>
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <div className="flex h-[calc(100%-var(--line-height-md))] flex-col">
              {activeRequestGroup && activeRequestGroup.environmentType === EnvironmentType.KVPAIR ? (
                <EnvironmentKVEditor
                  key={activeRequestGroup ? activeRequestGroup._id : 'n/a'}
                  data={activeRequestGroup?.kvPairData || []}
                  onChange={handleKVPairChange}
                />
              ) : (
                <EnvironmentEditor
                  ref={environmentEditorRef}
                  key={activeRequestGroup ? activeRequestGroup._id : 'n/a'}
                  environmentInfo={{
                    object: activeRequestGroup ? activeRequestGroup.environment : {},
                    propertyOrder: (activeRequestGroup && activeRequestGroup.environmentPropertyOrder) ?? null,
                  }}
                  onBlur={saveChanges}
                />
              )}
            </div>
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="docs">
          <MarkdownEditor
            key={uniqueKey}
            className="margin-top"
            placeholder="Write a description"
            defaultValue={activeRequestGroup.description}
            onChange={(description: string) => patchRequestGroup(activeRequestGroup._id, { description })}
          />
        </TabPanel>
      </Tabs>
      {isRequestGroupSettingsModalOpen && (
        <RequestGroupSettingsModal
          requestGroup={activeRequestGroup}
          onHide={() => setIsRequestGroupSettingsModalOpen(false)}
        />
      )}
    </>
  );
};
