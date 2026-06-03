import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { Request } from 'insomnia-data';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Button } from '~/basic-components/button';
import { SelectPopover } from '~/basic-components/select-popover';
import { getProjectRecentRequests, type RecentProjectRequest } from '~/common/project';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { AnalyticsEvent } from '~/ui/analytics';
import { createKeybindingsHandler, useKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { SvgIcon } from '~/ui/components/svg-icon';
import { showToast } from '~/ui/components/toast-notification';
import { Tooltip } from '~/ui/components/tooltip';
import { getBadgeClassName, ResourceIcon } from '~/ui/components/workspace/resource-icon';
import { setDefaultProtocol } from '~/utils/url/protocol';

import { Icon } from './icon';
const CURL_COMMAND_PATTERN = /^\s*\$?\s*curl(?:\s|$)/i;
const NOTION_MCP_SERVER_URL = 'https://mcp.notion.com/mcp';

const parseCurlImportError = (error: unknown) => {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return rawMessage.includes('No importers found for file')
    ? 'Invalid cURL request'
    : rawMessage.replace("Error invoking remote method 'parseImport': Error: ", '');
};

const parseCurlRequest = async (value: string) => {
  try {
    const { data } = await window.main.parseImport({ contentStr: value }, { importerId: 'curl' });
    const importedRequest = data?.resources?.[0] as Partial<Request> | undefined;

    if (!importedRequest?.url) {
      throw new Error('Invalid cURL request');
    }

    return importedRequest;
  } catch (error) {
    throw new Error(parseCurlImportError(error));
  }
};

const normalizeRequestUrl = (value: string) => {
  const normalizedUrl = setDefaultProtocol(value.trim());

  try {
    new URL(normalizedUrl);
    return normalizedUrl;
  } catch {
    throw new Error('Enter a valid endpoint URL');
  }
};

interface CollectionItem {
  id: string;
  label: string;
}

interface QuickStartItem {
  id: string;
  label: string;
  icon: JSX.Element;
  badge?: string;
  onClick: () => void | Promise<void>;
}

interface FirstRequestCreationProps {
  greetingName: string;
  collectionItems: CollectionItem[];
  selectedCollectionId: string | null;
  onSelectedCollectionChange: (collectionId: string | null) => void;
  onCreateCollection: () => void;
}

export const FirstRequestCreation = ({
  greetingName,
  collectionItems,
  selectedCollectionId,
  onSelectedCollectionChange,
  onCreateCollection,
}: FirstRequestCreationProps) => {
  const navigate = useNavigate();
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const createRequestFetcher = useRequestNewActionFetcher();
  const createWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const createWorkspaceFetcherRef = useRef(createWorkspaceFetcher);
  createWorkspaceFetcherRef.current = createWorkspaceFetcher;
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [requestInput, setRequestInput] = useState('');
  const [recentRequests, setRecentRequests] = useState<RecentProjectRequest[]>([]);
  const [curlParseError, setCurlParseError] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const trimmedInput = requestInput.trim();
  const isCreatingRequest = createRequestFetcher.state !== 'idle';
  const selectedCollection = collectionItems.find(collection => collection.id === selectedCollectionId) ?? null;
  const shouldShowJumpBackIn = recentRequests.length >= 3;

  const ensureWorkspaceId = async () => {
    if (selectedCollectionId) {
      return selectedCollectionId;
    }

    await createWorkspaceFetcher.submit({
      organizationId,
      projectId,
      name: 'My first collection',
      scope: 'collection',
      redirectAfterCreate: false,
      source: 'first-request-pane',
    });

    const createdWorkspace = createWorkspaceFetcherRef.current.data;

    if (
      !createdWorkspace ||
      createdWorkspace.error ||
      !('workspaceId' in createdWorkspace) ||
      !createdWorkspace.workspaceId
    ) {
      showToast({
        icon: 'circle-exclamation',
        title: 'Unable to create collection, please create collection manually',
        status: 'error',
      });
      return null;
    }
    return createdWorkspace.workspaceId;
  };

  const handleInputEnter = (event: ReactKeyboardEvent<HTMLTextAreaElement> | KeyboardEvent) => {
    event.preventDefault();
    handleCreateRequest();
  };

  const handleRequestCreateShortcut = (_event: KeyboardEvent) => {
    if (!selectedCollectionId) {
      createWorkspaceFetcher.submit({
        organizationId,
        projectId,
        name: 'My first collection',
        scope: 'collection',
        withRequest: true,
        source: 'first-request-pane',
      });
      return;
    }
    createRequestFetcher.submit({
      organizationId,
      projectId,
      workspaceId: selectedCollectionId,
      parentId: selectedCollectionId,
      requestType: 'HTTP',
      metrics: {
        source: 'first-request-pane',
      },
    });
  };

  useKeyboardShortcuts(() => inputRef.current as HTMLTextAreaElement, {
    request_createHTTP: handleRequestCreateShortcut,
  });

  const handleCreateRequest = async () => {
    if (!trimmedInput) {
      return;
    }
    const workspaceId = await ensureWorkspaceId();
    if (!workspaceId) {
      return;
    }

    try {
      if (CURL_COMMAND_PATTERN.test(trimmedInput)) {
        let req: Partial<Request>;
        try {
          req = await parseCurlRequest(trimmedInput);
        } catch {
          setCurlParseError(true);
          return;
        }

        createRequestFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          parentId: workspaceId,
          requestType: 'From Curl',
          req,
          metrics: {
            source: 'first-request-pane',
          },
        });

        return;
      }

      createRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        parentId: workspaceId,
        requestType: 'HTTP',
        req: {
          url: normalizeRequestUrl(trimmedInput),
        },
        metrics: {
          source: 'first-request-pane',
        },
      });
    } catch (error) {
      showToast({
        icon: 'circle-exclamation',
        title: error instanceof Error ? error.message : 'Unable to create request',
        status: 'error',
      });
    }
  };

  useEffect(() => {
    setSelectOpen(false);
  }, [selectedCollectionId]);

  useEffect(() => {
    let isActive = true;

    const loadRecentRequests = async () => {
      const nextRecentRequests = await getProjectRecentRequests(projectId);

      if (!isActive) {
        return;
      }

      setRecentRequests(nextRecentRequests);
    };

    loadRecentRequests();

    return () => {
      isActive = false;
    };
  }, [projectId]);

  const handleCreateNotionMcpWorkspace = () => {
    createWorkspaceFetcher.submit({
      organizationId,
      projectId,
      name: 'Notion MCP Server',
      scope: 'mcp',
      mcpServerUrl: NOTION_MCP_SERVER_URL,
      source: 'first-request-pane',
    });
  };

  const handleCreatePokemonRequest = async () => {
    const workspaceId = await ensureWorkspaceId();

    if (!workspaceId) {
      return;
    }

    createRequestFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      parentId: workspaceId,
      requestType: 'HTTP',
      req: {
        url: 'https://pokeapi.co/api/v2/pokemon/ditto',
        name: 'List a pokemon',
      },
      metrics: {
        source: 'first-request-pane',
      },
    });
  };

  const handleCreateGithubLookupRequest = async () => {
    const workspaceId = await ensureWorkspaceId();

    if (!workspaceId) {
      return;
    }

    const graphqlQuery =
      'query { viewer { repositories(first: 100, privacy: PUBLIC, affiliations: [OWNER]) { nodes { name description url stargazerCount } } } }';

    const githubGraphqlLookupCurl = `curl --request POST \
  --url https://api.github.com/graphql \
  --header 'Authorization: Bearer replace with your own token' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/12.5.1-alpha.0' \
  --data '${JSON.stringify({ query: graphqlQuery })}'`;
    try {
      const req = await parseCurlRequest(githubGraphqlLookupCurl);
      createRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        parentId: workspaceId,
        requestType: 'GraphQL',
        req: {
          ...req,
          name: 'Lookup GitHub repository',
        },
        metrics: {
          source: 'first-request-pane',
        },
      });
    } catch (error) {
      showToast({
        icon: 'circle-exclamation',
        title: error instanceof Error ? error.message : 'Unable to create GitHub lookup request',
        status: 'error',
      });
    }
  };

  const quickStartItems: QuickStartItem[] = [
    {
      id: 'mcp-server',
      label: 'Notion MCP Server',
      icon: <Icon icon={['fac', 'mcp'] as unknown as IconProp} />,
      onClick: handleCreateNotionMcpWorkspace,
    },
    {
      id: 'pokemon',
      label: 'List a pokemon',
      icon: <span className={getBadgeClassName('GET')}>GET</span>,
      badge: 'GET',
      onClick: handleCreatePokemonRequest,
    },
    {
      id: 'github-lookup',
      label: 'Lookup GitHub repository',
      icon: <SvgIcon icon="graphql" />,
      onClick: handleCreateGithubLookupRequest,
    },
  ];

  return (
    <>
      <div className="rounded-sm bg-[radial-gradient(95.72%_95.72%_at_-0.32%_2.6%,var(--hl-md)_0%,var(--hl-xs)_100%),radial-gradient(100%_100.41%_at_100%_99.92%,var(--hl-md)_0%,var(--hl-xs)_100%)] p-px">
        <div className="flex w-full flex-col items-center rounded-sm bg-(--color-bg) bg-[linear-gradient(180deg,rgba(var(--color-surprise-rgb),0.2)_0%,color-mix(in_srgb,var(--color-bg)_0%,transparent)_72.8%)] px-6 pt-8 pb-5">
          <h2 className="text-center text-2xl leading-none font-semibold">
            {shouldShowJumpBackIn ? `Welcome back, ${greetingName}!` : `Welcome, ${greetingName}!`}
          </h2>
          <p className="mt-2.5 text-center text-sm">
            {shouldShowJumpBackIn
              ? `Today is a new day, we’re rooting for you!`
              : `We have a sneaking suspicion that you came here to send a request, so let’s get started!`}
          </p>
          <div className="mt-8 w-[50%] min-w-100">
            <div className="flex aspect-540/127 flex-col overflow-hidden rounded-lg border border-[#3F3F46] bg-(--color-bg) shadow-[0_0_0_4px_#0044F433]">
              <div className="flex-1 px-4 pt-3 pb-2">
                <textarea
                  ref={inputRef}
                  autoFocus
                  aria-label="Request endpoint or cURL input"
                  className="text-md h-full w-full flex-1 resize-none font-mono"
                  placeholder="Enter an endpoint URL or paste cURL, or ⌘N for a new blank request"
                  value={requestInput}
                  onChange={event => {
                    setCurlParseError(false);
                    setRequestInput(event.target.value);
                  }}
                  onKeyDown={createKeybindingsHandler({
                    Enter: event => handleInputEnter(event),
                  })}
                />
              </div>
              <div className="flex items-center justify-between gap-2 p-2">
                <Tooltip message="Upload Postman, OpenAPI, etc.">
                  <Button
                    aria-label="Attach content"
                    className="w-10 rounded-md px-0"
                    size="md"
                    variant="text"
                    icon={<Icon className="text-lg" icon="paperclip" />}
                    onPress={() => {
                      window.main.trackAnalyticsEvent({
                        event: AnalyticsEvent.importStarted,
                        properties: {
                          source: 'first-request-pane',
                        },
                      });
                      setIsImportModalOpen(true);
                    }}
                  />
                </Tooltip>
                <div className="flex items-center gap-2">
                  <SelectPopover
                    isOpen={selectOpen}
                    onOpenChange={isOpen => setSelectOpen(isOpen)}
                    ariaLabel="Select target collection"
                    items={collectionItems}
                    selectedKey={selectedCollectionId}
                    onSelectionChange={key => {
                      onSelectedCollectionChange(key ? String(key) : null);
                      window.main.trackAnalyticsEvent({
                        event: AnalyticsEvent.firstRequestPaneCollectionChanged,
                      });
                    }}
                    title="Where should we put your request?"
                    emptyState="You have no collections, so a new one will be created for you by default."
                    footer={
                      <Button onPress={onCreateCollection} size="sm">
                        New Collection
                      </Button>
                    }
                    triggerClassName="h-8 rounded-md px-3 text-sm"
                    popoverClassName="w-[240px]"
                    dialogClassName="w-[240px]"
                    renderTrigger={selectedItem => (
                      <div className="flex items-center gap-2">
                        <span className="truncate">{selectedItem?.label ?? 'New collection'}</span>
                        <Icon icon="chevron-down" className="w-3 shrink-0" />
                      </div>
                    )}
                    renderItem={(item, isSelected) => (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {isSelected ? <Icon icon="check" className="text-(--color-success)" /> : null}
                      </>
                    )}
                  />
                  <Button
                    aria-label="Create request"
                    primary
                    size="md"
                    isDisabled={!trimmedInput || isCreatingRequest}
                    onPress={() => handleCreateRequest()}
                  >
                    <span>Create ⏎</span>
                  </Button>
                </div>
              </div>
            </div>
            {curlParseError && (
              <div className="mt-2 text-xs text-[#FF5631]">Invalid cURL. Verify your input and try again.</div>
            )}
            <div className="my-6 px-4">
              <p className="text-sm font-semibold text-(--hl)">
                {shouldShowJumpBackIn ? 'Jump back in' : 'Not sure where to start?'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {shouldShowJumpBackIn
                  ? recentRequests.map(recentRequest => (
                      <Button
                        key={recentRequest.request._id}
                        variant="outlined"
                        size="md"
                        className="px-2"
                        onPress={() => {
                          navigate(
                            `/organization/${organizationId}/project/${projectId}/workspace/${recentRequest.workspaceId}/debug/request/${recentRequest.request._id}`,
                          );
                        }}
                      >
                        <ResourceIcon resource={recentRequest.request} />
                        <span className="max-w-[18rem] truncate">{recentRequest.request.name}</span>
                      </Button>
                    ))
                  : quickStartItems.map(item => (
                      <Button
                        key={item.id}
                        variant="outlined"
                        size="md"
                        className="px-2"
                        onPress={() => {
                          window.main.trackAnalyticsEvent({
                            event: AnalyticsEvent.firstRequestPaneExampleClicked,
                            properties: {
                              name: item.label,
                            },
                          });
                          item.onClick();
                        }}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Button>
                    ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isImportModalOpen && (
        <ImportModal
          onHide={() => setIsImportModalOpen(false)}
          from={{ type: 'file' }}
          workspaceName={selectedCollection?.label}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultWorkspaceId={selectedCollectionId ?? undefined}
        />
      )}
    </>
  );
};
