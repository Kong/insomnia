
import type { Request } from 'insomnia-data';
import { setDefaultProtocol } from 'insomnia-data/common';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { Button } from '~/basic-components/button';
import { SelectPopover } from '~/basic-components/select-popover';
import { METHOD_GET } from '~/common/constants';
import { isCurlCommand } from '~/common/utils/curl';
import { MethodSelector } from '~/ui/components/dropdowns/method-selector';
import { createKeybindingsHandler, useKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showToast } from '~/ui/components/toast-notification';

import { useRequestNewActionFetcher } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useWorkspaceNewActionFetcher } from '../../routes/organization.$organizationId.project.$projectId.workspace.new';
import { Icon } from './icon';

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

// Read the HTTP method from a cURL string, for keeping the method dropdown in
// sync while typing/pasting/importing. Mirrors the real importer's extractMethod
// (src/main/importers/importers/curl.ts): explicit -X/--request wins (including
// curl's cuddled short-flag form, e.g. -XPUT); otherwise -G/--get combined with a
// -d/--data flag moves the data into the query string instead of the body (so the
// method stays GET); otherwise a body/form flag implies POST, otherwise GET.
// Always resolves so the preview never goes stale relative to what the actual
// import would produce.
const extractCurlMethod = (value: string): string => {
  const explicit = value.match(/(?:-X\s*|--request\s+)['"]?([A-Za-z]+)/);
  if (explicit) {
    return explicit[1].toUpperCase();
  }
  const hasGetFlag = /(?:^|\s)(?:-G|--get)\b/.test(value);
  const hasDataFlag = /(?:^|\s)(?:-d|--data(?:-raw|-binary|-urlencode|-ascii)?)\b/.test(value);
  if (hasGetFlag && hasDataFlag) {
    return METHOD_GET;
  }
  if (hasDataFlag || /(?:^|\s)(?:-F|--form)\b/.test(value)) {
    return 'POST';
  }
  return METHOD_GET;
};

interface CollectionItem {
  id: string;
  label: string;
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
}: FirstRequestCreationProps) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const createRequestFetcher = useRequestNewActionFetcher();
  const createWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const createWorkspaceFetcherRef = useRef(createWorkspaceFetcher);
  createWorkspaceFetcherRef.current = createWorkspaceFetcher;
  const [requestInput, setRequestInput] = useState('');
  const [method, setMethod] = useState(METHOD_GET);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const trimmedInput = requestInput.trim();
  const isCreatingRequest = createRequestFetcher.state !== 'idle';


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

  // Update the input value and clear any stale error. Doesn't touch the method
  // dropdown, so typing out a cURL command by hand doesn't flip the method
  // mid-keystroke — that preview sync only happens when a cURL command is pasted
  // (see the input's onPaste handler).
  const applyRequestInput = (value: string) => {
    setRequestInput(value);
    setErrorText(null);
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
    });
  };

  useKeyboardShortcuts(() => inputRef.current as HTMLInputElement, {
    request_createHTTP: handleCreateBlankRequest,
  });

  const handleCreateRequest = async () => {
    if (!trimmedInput) {
      handleCreateBlankRequest();
      return;
    }
    const workspaceId = await ensureWorkspaceId();
    if (!workspaceId) {
      return;
    }

    try {
      if (isCurlCommand(trimmedInput)) {
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
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to create request');
    }
  };

  useEffect(() => {
    setSelectOpen(false);
  }, [selectedCollectionId]);

  // Focus the request input whenever the pane is (re-)shown for a project. A plain
  // `autoFocus` attribute only fires on the input's initial DOM mount, so it misses
  // client-side navigations between projects that reuse this component instance.
  useEffect(() => {
    inputRef.current?.focus();
  }, [projectId]);







  return (
    <>
      <div className="rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs)">
        <div className="flex w-full flex-col gap-2 p-3">
          <h2 className="text-[13px] font-semibold">New request</h2>
          <div className="flex h-(--line-height-sm) items-center gap-1.5 rounded-md border border-(--hl-md) bg-(--color-bg) p-1 focus-within:shadow-[0_0_0_4px_#0044F433]">
            <MethodSelector method={method} onChange={setMethod} className="h-full" placement="bottom start" />
            <input
              ref={inputRef}
              aria-label="Request endpoint or cURL input"
              className="h-6.5 min-w-0 flex-1 bg-transparent px-1 text-[12px]/[18px] font-normal outline-none"
              placeholder="Enter a URL or paste cURL"
              value={requestInput}
              onChange={event => applyRequestInput(event.target.value)}
              onPaste={event => {
                const pasted = event.clipboardData.getData('text');
                // Flatten a pasted multi-line cURL into a single line ourselves so it
                // stays a valid command (the native single-line paste would drop the newlines).
                const value = /\r?\n/.test(pasted) ? flattenCurlCommand(pasted) : pasted;
                if (isCurlCommand(value)) {
                  event.preventDefault();
                  applyRequestInput(value);
                  setMethod(extractCurlMethod(value));
                }
              }}
              onKeyDown={createKeybindingsHandler({
                Enter: event => handleInputEnter(event),
              })}
            />
            <SelectPopover
              isOpen={selectOpen}
              onOpenChange={isOpen => setSelectOpen(isOpen)}
              ariaLabel="Select target API collection"
              placement="bottom end"
              items={collectionItems}
              selectedKey={selectedCollectionId}
              onSelectionChange={key => {
                onSelectedCollectionChange(key ? String(key) : null);
              }}
              title="Where should we put your request?"
              emptyState="You have no API collections, so a new one will be created for you by default."
              footer={
                <Button onPress={onCreateCollection} size="sm">
                  New API Collection
                </Button>
              }
              triggerClassName="h-full rounded-md px-3 text-[12px]/[18px] font-[590] data-[focus-visible=true]:!ring-0"
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
              className="h-full rounded-sm px-2 text-[12px]/[18px] font-[590]"
              isDisabled={isCreatingRequest || createWorkspaceFetcher.state !== 'idle'}
              onPress={() => handleCreateRequest()}
            >
              <span>Create HTTP Request ⏎</span>
            </Button>
          </div>
          <div className="min-h-4 text-xs text-[#FF5631]" role="alert" aria-live="polite">
            {errorText}
          </div>

        </div>
      </div>
    </>
  );
};
