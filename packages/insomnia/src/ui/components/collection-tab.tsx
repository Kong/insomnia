import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useNavigate } from 'react-router';
import { twMerge } from 'tailwind-merge';

import { getAuthObjectOrNull } from '~/network/authentication';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { AuthWrapper } from '~/ui/components/editors/auth/auth-wrapper';
import { RequestHeadersEditor } from '~/ui/components/editors/request-headers-editor';
import { RequestScriptEditor } from '~/ui/components/editors/request-script-editor';
import { MarkdownEditor } from '~/ui/components/markdown-editor';
import { WorkspaceEnvironmentsEditor } from '~/ui/components/workspace-environments-editor';
import { useWorkspacePatcher } from '~/ui/hooks/use-request';
import { useGitVCSVersion } from '~/ui/hooks/use-vcs-version';

import { ErrorBoundary } from './error-boundary';
import { Icon } from './icon';

interface Props {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  activeItemId: string;
  enableLegacyUnitTests: boolean;
  hasLegacyUnitTests: boolean;
  className?: string;
}

const tabClassName =
  'flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)';

const TabActiveDot = () => (
  <span
    data-testid="tab-active-dot"
    className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs"
  >
    <span className="h-2 w-2 rounded-full bg-green-500" />
  </span>
);

export const CollectionTab = ({
  organizationId,
  projectId,
  workspaceId,
  activeItemId,
  enableLegacyUnitTests,
  hasLegacyUnitTests,
  className,
}: Props) => {
  const { activeWorkspace, baseEnvironment, vcsVersion } = useWorkspaceLoaderData()!;

  const patchWorkspace = useWorkspacePatcher();
  const gitVersion = useGitVCSVersion();

  const uniqueKey = `${activeWorkspace._id}::${gitVersion}::${vcsVersion}`;
  const headers = activeWorkspace.headers || [];
  const headersCount = headers.filter(h => !h.disabled).length;
  const workspaceAuth = getAuthObjectOrNull(activeWorkspace.authentication);
  const authIsNone = workspaceAuth === null;

  const navigate = useNavigate();
  const base = `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}`;

  // The setting forces the tab to show. Otherwise, only show it if the collection already has legacy tests.
  const showTestsTab = enableLegacyUnitTests || hasLegacyUnitTests;

  const items: { id: string; name: string; to: string }[] = [
    { id: 'spec', name: 'Spec', to: `${base}/debug` },
    ...(showTestsTab ? [{ id: 'test' as const, name: 'Tests', to: `${base}/test` }] : []),
  ];

  return (
    <Tabs
      data-testid="collection-tab"
      aria-label="Collection tabs"
      className={twMerge(
        'flex w-full flex-col',
        // Spec/test views render their own content below the tabs, so only fill the height for the panel tabs
        !items.some(item => item.id === activeItemId) && 'h-full flex-1',
      )}
      selectedKey={activeItemId}
      onSelectionChange={key => {
        const item = items.find(item => item.id === key);
        const newKey = String(key);
        if (item) {
          // Spec and test tabs for navigation
          item && navigate(item.to);
        } else {
          navigate(`${base}/debug?collectionActiveTab=${newKey}`);
        }
      }}
    >
      <TabList
        aria-label="API Collection Tabs"
        className={twMerge(
          'flex h-(--line-height-sm) w-full shrink-0 items-center border-b border-solid border-b-(--hl-md) bg-(--color-bg)',
          className,
        )}
      >
        {items.map(item => (
          <Tab
            key={item.id}
            id={item.id}
            className={tabClassName}
            data-testid={`api-collection-tab-${item.name.toLowerCase()}`}
          >
            {item.name}
          </Tab>
        ))}
        <Tab className={tabClassName} id="auth" data-testid="api-collection-tab-auth">
          <span>Auth</span>
          {!authIsNone && <TabActiveDot />}
        </Tab>
        <Tab className={tabClassName} id="headers">
          <span>Headers</span>
          {headersCount > 0 && (
            <span
              data-testid="tab-count-badge"
              className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-(--hl) p-1 text-xs"
            >
              {headersCount}
            </span>
          )}
        </Tab>
        <Tab className={tabClassName} id="scripts">
          <span>Scripts</span>
          {Boolean(activeWorkspace.preRequestScript || activeWorkspace.afterResponseScript) && <TabActiveDot />}
        </Tab>
        <Tab className={tabClassName} id="environment">
          Environment
        </Tab>
        <Tab className={tabClassName} id="docs">
          Docs
        </Tab>
      </TabList>
      <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="auth">
        <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
          <AuthWrapper authentication={activeWorkspace.authentication} />
        </ErrorBoundary>
      </TabPanel>
      <TabPanel className="w-full flex-1 overflow-y-auto" id="headers">
        <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
          <RequestHeadersEditor bulk={false} headers={headers} requestType="Workspace" />
        </ErrorBoundary>
      </TabPanel>
      <TabPanel className="w-full flex-1" id="scripts">
        <Tabs className="flex h-full w-full flex-col overflow-hidden">
          <TabList
            className="flex h-(--line-height-sm) w-full shrink-0 items-center gap-2 overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg) px-2"
            aria-label="Request scripts tabs"
          >
            <Tab
              className="flex h-(--line-height-xxs) w-40 shrink-0 cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-(--color-font-surprise) aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-(--color-font-surprise)"
              id="pre-request"
            >
              <div className="flex flex-1 items-center gap-2">
                <Icon icon="arrow-right-to-bracket" />
                <span className="whitespace-nowrap">Pre-request</span>
              </div>
              {Boolean(activeWorkspace.preRequestScript) && (
                <span className="rounded-lg p-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              )}
            </Tab>
            <Tab
              className="flex h-(--line-height-xxs) w-46 shrink-0 cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-[rgba(var(--color-surprise-rgb),50%)] hover:text-(--color-font-surprise) aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] aria-selected:text-(--color-font-surprise)"
              id="after-response"
            >
              <div className="flex flex-1 items-center gap-2">
                <Icon icon="arrow-right-from-bracket" />
                <span className="whitespace-nowrap">After-response</span>
              </div>
              {Boolean(activeWorkspace.afterResponseScript) && (
                <span className="rounded-lg p-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              )}
            </Tab>
          </TabList>
          <TabPanel className="w-full flex-1" id="pre-request">
            <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
              <RequestScriptEditor
                historyKey={`${activeWorkspace._id}:pre-request-script`}
                defaultValue={activeWorkspace.preRequestScript || ''}
                onChange={preRequestScript => patchWorkspace(workspaceId, { preRequestScript })}
              />
            </ErrorBoundary>
          </TabPanel>
          <TabPanel className="w-full flex-1" id="after-response">
            <ErrorBoundary key={uniqueKey} errorClassName="tall wide vertically-align font-error pad text-center">
              <RequestScriptEditor
                historyKey={`${activeWorkspace._id}:after-response-script`}
                defaultValue={activeWorkspace.afterResponseScript || ''}
                onChange={afterResponseScript => patchWorkspace(workspaceId, { afterResponseScript })}
              />
            </ErrorBoundary>
          </TabPanel>
        </Tabs>
      </TabPanel>
      <TabPanel className="flex w-full flex-1 flex-col overflow-hidden pb-2" id="environment">
        <WorkspaceEnvironmentsEditor initialEnvironmentId={baseEnvironment._id} selectionRequestId={0} />
      </TabPanel>
      <TabPanel className="w-full flex-1 overflow-y-auto" id="docs">
        <MarkdownEditor
          // Stable per-request key: a volatile key here remounts the editor on
          // every revalidation, resetting its internal state (content, active
          // tab) and clobbering undo. Descriptions don't depend on env/response,
          // so a stable key is safe.
          key={`workspace-description::${workspaceId}`}
          historyKey={`workspace-description::${workspaceId}`}
          placeholder="Write a description"
          defaultValue={activeWorkspace.description}
          onChange={(description: string) => patchWorkspace(workspaceId, { description })}
        />
      </TabPanel>
    </Tabs>
  );
};
