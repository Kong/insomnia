import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import { Button } from '~/basic-components/button';
import { SelectPopover } from '~/basic-components/select-popover';
import type { Request } from '~/insomnia-data';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { createKeybindingsHandler, useKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { showToast } from '~/ui/components/toast-notification';
import { Tooltip } from '~/ui/components/tooltip';
import { setDefaultProtocol } from '~/utils/url/protocol';

import { Icon } from './icon';

const CURL_COMMAND_PATTERN = /^\s*\$?\s*curl(?:\s|$)/i;

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
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const createRequestFetcher = useRequestNewActionFetcher();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [requestInput, setRequestInput] = useState('');
  const [curlParseError, setCurlParseError] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const trimmedInput = requestInput.trim();
  const isCreatingRequest = createRequestFetcher.state !== 'idle';
  const selectedCollection = collectionItems.find(collection => collection.id === selectedCollectionId) ?? null;

  const handleInputEnter = (event: ReactKeyboardEvent<HTMLTextAreaElement> | KeyboardEvent) => {
    event.preventDefault();
    handleCreateRequest();
  };

  const handleRequestCreateShortcut = (_event: KeyboardEvent) => {
    if (!selectedCollectionId) {
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

  useKeyboardShortcuts(() => inputRef.current as HTMLTextAreaElement, {
    request_createHTTP: handleRequestCreateShortcut,
  });

  const handleCreateRequest = async () => {
    if (!trimmedInput) {
      return;
    }

    if (!selectedCollectionId) {
      showToast({
        icon: 'circle-exclamation',
        title: 'Create a collection first',
        description: 'Choose a destination collection before creating your request.',
        status: 'warning',
      });
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
          workspaceId: selectedCollectionId,
          parentId: selectedCollectionId,
          requestType: 'From Curl',
          req,
        });

        return;
      }

      createRequestFetcher.submit({
        organizationId,
        projectId,
        workspaceId: selectedCollectionId,
        parentId: selectedCollectionId,
        requestType: 'HTTP',
        req: {
          url: normalizeRequestUrl(trimmedInput),
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

  return (
    <>
      <div className="w-full overflow-hidden rounded-sm bg-[radial-gradient(100%_100.41%_at_100%_99.92%,#4C4C4C_0%,rgba(3,3,3,0)_100%),radial-gradient(95.72%_95.72%_at_-0.32%_2.6%,#4C4C4C_0%,rgba(3,3,3,0)_100%)] p-px">
        <div className="flex h-90 w-full flex-col items-center rounded-[inherit] bg-[#1B1B1B] bg-linear-[360deg,rgba(27,27,27,0)_27.2%,rgba(165,151,248,0.2)_100%] px-6 pt-6 pb-5">
          <h2 className="text-center text-2xl leading-none font-semibold">Welcome, {greetingName}!</h2>
          <p className="mt-2.5 text-center text-sm">
            We have a sneaking suspicion that you came here to send a request, so let’s get started!
          </p>
          <div className="mt-8 w-full max-w-135">
            <div className="flex aspect-540/127 flex-col overflow-hidden rounded-lg border border-[#3F3F46] bg-[#18181B] shadow-[0_0_0_4px_#0044F433]">
              <div className="flex-1 px-4 pt-3 pb-2">
                <textarea
                  ref={inputRef}
                  autoFocus
                  aria-label="Request endpoint or cURL input"
                  className="h-full w-full flex-1 resize-none font-mono text-xs"
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
                    className="w-10 rounded-full px-0"
                    size="lg"
                    variant="text"
                    icon={<Icon className="text-lg" icon="paperclip" />}
                    onPress={() => setIsImportModalOpen(true)}
                  />
                </Tooltip>
                <div className="flex items-center gap-3">
                  <SelectPopover
                    isOpen={selectOpen}
                    onOpenChange={isOpen => setSelectOpen(isOpen)}
                    ariaLabel="Select target collection"
                    items={collectionItems}
                    selectedKey={selectedCollectionId}
                    onSelectionChange={key => onSelectedCollectionChange(key ? String(key) : null)}
                    title="Import destination"
                    emptyState="You have no collections, so a new one will be created for you by default."
                    footer={
                      <Button onPress={onCreateCollection} size="sm">
                        New Collection
                      </Button>
                    }
                    triggerClassName="h-8 rounded-xs px-3 text-sm"
                    popoverClassName="w-[240px]"
                    dialogClassName="w-[240px]"
                    renderTrigger={selectedItem => (
                      <>
                        <span className="truncate">{selectedItem?.label ?? 'New collection'}</span>
                        <Icon icon="chevron-down" className="w-3 shrink-0" />
                      </>
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
                    isDisabled={!trimmedInput || !selectedCollectionId || isCreatingRequest}
                    onPress={() => void handleCreateRequest()}
                  >
                    <span>Create</span>
                    <span aria-hidden="true" className="text-sm leading-none">
                      ↵
                    </span>
                  </Button>
                </div>
              </div>
            </div>
            {curlParseError && (
              <div className="mt-2 text-xs text-[#FF5631]">Invalid cURL. Verify your input and try again.</div>
            )}
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
