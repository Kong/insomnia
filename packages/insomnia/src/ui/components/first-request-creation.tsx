import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { Request } from 'insomnia-data';
import { services } from 'insomnia-data';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { Button } from '~/basic-components/button';
import { SelectPopover } from '~/basic-components/select-popover';
import { METHOD_GET } from '~/common/constants';
import { setDefaultProtocol } from '~/common/utils/url/protocol';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import { AnalyticsEvent } from '~/ui/analytics';
import { MethodSelector } from '~/ui/components/dropdowns/method-selector';
import { createKeybindingsHandler, useKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { SvgIcon } from '~/ui/components/svg-icon';
import { showToast } from '~/ui/components/toast-notification';
import { getBadgeClassName } from '~/ui/components/workspace/resource-icon';
import {
  FIRST_REQUEST_EXPERIMENT_LAUNCH_DATE,
  FIRST_REQUEST_EXPERIMENT_NAME,
  type FirstRequestTreatment,
  getBackendFirstRequestTreatment,
  getBackendIsNewSignup,
  getFirstRequestTreatmentGroup,
  isFirstRequestExperimentParticipant,
  readCachedFirstRequestTreatment,
  resolveFirstRequestTreatment,
  writeCachedFirstRequestTreatment,
} from '~/ui/utils/first-request-treatment';

import { useRequestNewActionFetcher } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useWorkspaceNewActionFetcher } from '../../routes/organization.$organizationId.project.$projectId.workspace.new';
import { Icon } from './icon';

// Guards the experiment-assignment analytics event so a given (account, treatment)
// isn't emitted twice within an app session (cross-session de-dup uses the cache).
const emittedAssignments = new Set<string>();

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

// Collapse a multi-line cURL (backslash line-continuations and/or bare newlines,
// with their trailing indentation) into a single line, preserving intra-line spacing.
const flattenCurlCommand = (value: string) =>
  value
    .replace(/\\\r?\n\s*/g, ' ')
    .replace(/\r?\n\s*/g, ' ')
    .trim();

// Best-effort read of the HTTP method from a cURL string, for keeping the method
// dropdown in sync while typing/pasting. Explicit -X/--request wins; otherwise a
// body/form flag implies POST (curl's own default), matching what the importer does.
const extractCurlMethod = (value: string): string | null => {
  const explicit = value.match(/(?:-X|--request)\s+['"]?([A-Za-z]+)/);
  if (explicit) {
    return explicit[1].toUpperCase();
  }
  if (/(?:^|\s)(?:-d|--data(?:-raw|-binary|-urlencode)?|-F|--form)\b/.test(value)) {
    return 'POST';
  }
  return null;
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
  collectionItems: CollectionItem[];
  selectedCollectionId: string | null;
  onSelectedCollectionChange: (collectionId: string | null) => void;
  onCreateCollection: () => void;
  onImportFrom: () => void;
}

export const FirstRequestCreation = ({
  collectionItems,
  selectedCollectionId,
  onSelectedCollectionChange,
  onCreateCollection,
  onImportFrom,
}: FirstRequestCreationProps) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const { userSession, settings } = useRootLoaderData()!;
  const organizationData = useOrganizationLoaderData();
  // Stable id used to bucket new sign-ups ~50/50 into Treatment A or B.
  const cohortId = userSession.accountId || settings.deviceId || '';
  // Server-computed treatment, when the backend provides it (authoritative).
  const backendTreatment = getBackendFirstRequestTreatment(organizationData?.user);
  // Account creation time (epoch ms); pre-GA accounts are treated as existing users.
  const accountCreatedAt = organizationData?.user?.created_at
    ? new Date(organizationData.user.created_at).getTime()
    : undefined;
  // Whether this user is part of the experiment population (a genuine new sign-up).
  // Only participants emit assignment analytics; existing users still get B in the UI.
  const isParticipant = isFirstRequestExperimentParticipant({
    isNewSignup: getBackendIsNewSignup(organizationData?.user),
    accountCreatedAt,
    experimentLaunchedAt: FIRST_REQUEST_EXPERIMENT_LAUNCH_DATE,
  });
  // Last-known treatment for this account, used as an offline fallback.
  const [cachedTreatment] = useState(() => readCachedFirstRequestTreatment(userSession.accountId || ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const createRequestFetcher = useRequestNewActionFetcher();
  const createWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const createWorkspaceFetcherRef = useRef(createWorkspaceFetcher);
  createWorkspaceFetcherRef.current = createWorkspaceFetcher;
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [requestInput, setRequestInput] = useState('');
  const [method, setMethod] = useState(METHOD_GET);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  // null while stats are loading; treatment is derived once we know the created-request count.
  const [createdRequests, setCreatedRequests] = useState<number | null>(null);
  const trimmedInput = requestInput.trim();
  const isCreatingRequest = createRequestFetcher.state !== 'idle';
  const selectedCollection = collectionItems.find(collection => collection.id === selectedCollectionId) ?? null;

  const treatment: FirstRequestTreatment | null = resolveFirstRequestTreatment({
    backendTreatment,
    accountCreatedAt,
    experimentLaunchedAt: FIRST_REQUEST_EXPERIMENT_LAUNCH_DATE,
    createdRequests,
    cohortId,
    cachedTreatment,
  });
  const createButtonLabel = treatment === 'B' ? 'Create HTTP Request ⏎' : 'Create ⏎';

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

  const handleInputEnter = (event: ReactKeyboardEvent<HTMLInputElement> | KeyboardEvent) => {
    event.preventDefault();
    handleCreateRequest();
  };

  // Update the input value, clear any stale error, and keep the method dropdown in
  // sync when the value is a cURL command.
  const applyRequestInput = (value: string) => {
    setRequestInput(value);
    setErrorText(null);
    if (CURL_COMMAND_PATTERN.test(value.trim())) {
      const curlMethod = extractCurlMethod(value);
      if (curlMethod) {
        setMethod(curlMethod);
      }
    }
  };

  const handleCreateBlankRequest = () => {
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

  useKeyboardShortcuts(() => inputRef.current as HTMLInputElement, {
    request_createHTTP: handleCreateBlankRequest,
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
          setErrorText('Invalid cURL. Verify your input and try again.');
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
          method,
        },
        metrics: {
          source: 'first-request-pane',
        },
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to create request');
    }
  };

  useEffect(() => {
    setSelectOpen(false);
  }, [selectedCollectionId]);

  // Load the lifetime created-request count, used by the client-side fallback.
  useEffect(() => {
    let isActive = true;

    services.stats.get().then(stats => {
      if (isActive) {
        setCreatedRequests(stats.createdRequests);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  // On a *confident* treatment result, emit an experiment-assignment analytics event
  // only when the treatment changed vs the last-known (cached) value — i.e. on the
  // initial assignment and on a Treatment A→B transition. The warehouse derives each
  // assignment's `experiment_end_at` as the next assignment's timestamp (LEAD).
  useEffect(() => {
    if (!treatment) {
      return;
    }

    // Confident = from the backend or a full client-side computation, never a value
    // that itself came from the cache/default (which would create phantom churn).
    const isConfident =
      backendTreatment !== undefined ||
      (accountCreatedAt !== undefined &&
        (accountCreatedAt < FIRST_REQUEST_EXPERIMENT_LAUNCH_DATE || createdRequests !== null));
    if (!isConfident) {
      return;
    }

    const accountId = userSession.accountId || '';
    // Persist the last-known treatment for offline rendering (all users, incl. existing).
    writeCachedFirstRequestTreatment(accountId, treatment);

    // Emit assignment analytics only for experiment participants (new sign-ups) — existing
    // users get B but are not part of the A/B population — and only when the treatment
    // changed vs the last-known value (initial assignment or A→B transition).
    if (!isParticipant) {
      return;
    }
    const changed = treatment !== cachedTreatment;
    const sessionKey = `${accountId || 'anonymous'}:${treatment}`;
    if (changed && !emittedAssignments.has(sessionKey)) {
      emittedAssignments.add(sessionKey);
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.experimentAssigned,
        properties: {
          experiment_name: FIRST_REQUEST_EXPERIMENT_NAME,
          treatment_group: getFirstRequestTreatmentGroup(treatment),
          assigned_at: new Date().toISOString(),
        },
      });
    }
  }, [treatment, isParticipant, backendTreatment, accountCreatedAt, createdRequests, userSession.accountId, cachedTreatment]);

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
        url: 'https://pokeapi.co/api/v2/pokemon?offset=0&limit=10',
        name: 'List pokemon',
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

  const quickActions: QuickStartItem[] = [
    {
      id: 'new-http-request',
      label: 'New HTTP request',
      icon: <Icon icon="plus" className="text-(--font-size-xl)" />,
      onClick: handleCreateBlankRequest,
    },
    {
      id: 'import-files',
      label: 'Import files',
      icon: <Icon icon="file-import" className="text-(--font-size-xl)" />,
      onClick: () => {
        window.main.trackAnalyticsEvent({
          event: AnalyticsEvent.importStarted,
          properties: {
            source: 'first-request-pane-example',
          },
        });
        onImportFrom();
      },
    },
  ];

  const exampleItems: QuickStartItem[] = [
    {
      id: 'mcp-server',
      label: 'Connect to Notion MCP',
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

  const renderQuickStartButton = (item: QuickStartItem) => (
    <Button
      key={item.id}
      variant="outlined"
      size="md"
      className="h-6.5 px-2"
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
  );

  return (
    <>
      <div className="rounded-sm bg-[radial-gradient(95.72%_95.72%_at_-0.32%_2.6%,var(--hl-md)_0%,var(--hl-xs)_100%),radial-gradient(100%_100.41%_at_100%_99.92%,var(--hl-md)_0%,var(--hl-xs)_100%)] p-px">
        <div className="flex w-full flex-col rounded-sm bg-(--color-bg) bg-[linear-gradient(180deg,rgba(var(--color-surprise-rgb),0.2)_0%,color-mix(in_srgb,var(--color-bg)_0%,transparent)_72.8%)] px-6 pt-5 pb-6">
          <h2 className="text-lg font-semibold">New request</h2>
          <div className="mt-4 flex h-8.5 items-center gap-2 rounded-md border border-(--hl-md) bg-(--color-bg) px-1">
            <MethodSelector method={method} onChange={setMethod} className="h-6.5" />
            <input
              ref={inputRef}
              autoFocus
              aria-label="Request endpoint or cURL input"
              className="h-6.5 min-w-0 flex-1 bg-transparent text-[12px]/[18px] font-normal"
              placeholder="Enter a URL or paste cURL"
              value={requestInput}
              onChange={event => applyRequestInput(event.target.value)}
              onPaste={event => {
                const pasted = event.clipboardData.getData('text');
                // Flatten a pasted multi-line cURL into a single line ourselves so it
                // stays a valid command (the native single-line paste would drop the newlines).
                if (/\r?\n/.test(pasted) && CURL_COMMAND_PATTERN.test(pasted.trim())) {
                  event.preventDefault();
                  applyRequestInput(flattenCurlCommand(pasted));
                }
              }}
              onKeyDown={createKeybindingsHandler({
                Enter: event => handleInputEnter(event),
              })}
            />
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
              triggerClassName="h-6.5 rounded-md px-3 text-[12px]/[18px] font-[590] data-[focus-visible=true]:!ring-0"
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
              className="h-6.5 rounded-sm px-2 text-[12px]/[18px] font-[590]"
              isDisabled={!trimmedInput || isCreatingRequest}
              onPress={() => handleCreateRequest()}
            >
              <span>{createButtonLabel}</span>
            </Button>
          </div>
          {errorText && (
            <div className="mt-2 text-xs text-[#FF5631]" role="alert" aria-live="polite">
              {errorText}
            </div>
          )}

          {treatment === 'A' && (
            <div className="mt-6 flex flex-wrap gap-x-10 gap-y-6">
              <div>
                <p className="text-sm font-semibold text-(--hl)">Quick actions</p>
                <div className="mt-3 flex flex-wrap gap-2">{quickActions.map(renderQuickStartButton)}</div>
              </div>
              <div>
                <p className="text-sm font-semibold text-(--hl)">Start with an example</p>
                <div className="mt-3 flex flex-wrap gap-2">{exampleItems.map(renderQuickStartButton)}</div>
              </div>
            </div>
          )}
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
