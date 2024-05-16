import React, { FC, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { Settings } from '../../../models/settings';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import { RequestGroupLoaderData } from '../../routes/request-group';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { PreRequestScriptEditor } from '../editors/pre-request-script-editor';
import { ErrorBoundary } from '../error-boundary';
import { MarkdownPreview } from '../markdown-preview';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';

export const RequestGroupPane: FC<{ settings: Settings }> = ({ settings }) => {
  const { activeRequestGroup } = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const [isRequestGroupSettingsModalOpen, setIsRequestGroupSettingsModalOpen] = useState(false);
  const patchRequestGroup = useRequestGroupPatcher();

  // const uniqueKey = `${activeEnvironment?.modified}::${activeRequestGroup._id}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta?.activeResponseId}`;
  // TODO
  const uniqueKey = `${activeRequestGroup._id}`;
  return (
    <>
      <Tabs aria-label="Request group pane tabs">
        <TabItem key="auth" title={<AuthDropdown authentication={activeRequestGroup.authentication} />}>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <div />
            {/* <AuthWrapper /> */}
          </ErrorBoundary>
        </TabItem>
        <TabItem
          key="docs"
          title={
            <>
              Docs
              {activeRequestGroup.description && (
                <span className="ml-2 p-2 border-solid border border-[--hl-md] rounded-lg">
                  <span className="flex w-2 h-2 bg-green-500 rounded-full" />
                </span>
              )}
            </>
          }
        >
          <PanelContainer className="tall">
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
          </PanelContainer>
        </TabItem>
        <TabItem
          key="pre-request-script"
          data-testid="pre-request-script-tab"
          title={
            <div className='flex items-center gap-2'>
              Pre-request Script{' '}
              {activeRequestGroup.preRequestScript && (
                <span className="ml-2 p-2 border-solid border border-[--hl-md] rounded-lg">
                  <span className="flex w-2 h-2 bg-green-500 rounded-full" />
                </span>
              )}
            </div>
          }
          aria-label={'experimental'}
        >
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="tall wide vertically-align font-error pad text-center"
          >
            <PreRequestScriptEditor
              uniquenessKey={uniqueKey}
              defaultValue={activeRequestGroup.preRequestScript || ''}
              onChange={preRequestScript => patchRequestGroup(activeRequestGroup._id, { preRequestScript })}
              settings={settings}
            />
          </ErrorBoundary>
        </TabItem>
      </Tabs>
      {isRequestGroupSettingsModalOpen && (
        <RequestGroupSettingsModal
          requestGroup={activeRequestGroup}
          onHide={() => setIsRequestGroupSettingsModalOpen(false)}
        />
      )}</>
  );
};
