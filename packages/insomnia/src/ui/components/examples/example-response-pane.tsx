import type { Example, ResponseHeader, ResponseTimelineEntry } from 'insomnia-data';
import { models } from 'insomnia-data';
import { getPreviewModeName, PREVIEW_MODE_FRIENDLY, PREVIEW_MODES, type PreviewMode } from 'insomnia-data/common';
import { RESPONSE_CODE_REASONS } from 'insomnia-data/common';
import React, { useEffect, useState } from 'react';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { LARGE_EXAMPLE_RESPONSE_MB } from '~/common/constants';
import { bodyBufferToUtf8 } from '~/common/utils/utf8-bytes';
import { cancelRequestById } from '~/network/cancellation.renderer';
import { useRootLoaderData } from '~/root';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { Dropdown, DropdownItem, ItemContent } from '~/ui/components/base/dropdown';
import { KeyValueEditor } from '~/ui/components/key-value-editor/key-value-editor';
import { Pane, PaneBody, PaneHeader } from '~/ui/components/panes/pane';
import { PlaceholderResponsePane } from '~/ui/components/panes/placeholder-response-pane';
import { ResponseTimer } from '~/ui/components/response-timer';
import { SizeTag } from '~/ui/components/tags/size-tag';
import { StatusTag } from '~/ui/components/tags/status-tag';
import { TimeTag } from '~/ui/components/tags/time-tag';
import { ResponseHeadersViewer } from '~/ui/components/viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '~/ui/components/viewers/response-timeline-viewer';
import { ResponseViewer } from '~/ui/components/viewers/response-viewer';
import { useUpdateExample } from '~/ui/hooks/use-example-mutations';
import type { ExampleTryItResult } from '~/ui/hooks/use-example-try-it';
import { useExecutionState } from '~/ui/hooks/use-execution-state';

interface ExampleResponsePaneProps {
  example: Example;
  // Result of the latest Try it send, if any
  tryItResult: ExampleTryItResult | null;
  isSending: boolean;
}

const parseTimeline = (timeline: string[] | undefined): ResponseTimelineEntry[] => {
  if (!timeline) {
    return [];
  }
  return timeline
    .map(line => {
      try {
        return JSON.parse(line) as ResponseTimelineEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is ResponseTimelineEntry => entry !== null);
};

export const ExampleResponsePane = ({ example, tryItResult, isSending }: ExampleResponsePaneProps) => {
  const updateExample = useUpdateExample();
  const { settings } = useRootLoaderData()!;
  const [view, setView] = useState<'example' | 'actual'>('example');
  const [statusCodeDraft, setStatusCodeDraft] = useState(String(example.response.statusCode));
  const [statusCodeError, setStatusCodeError] = useState('');

  const changeStatusCode = (value: string) => {
    setStatusCodeDraft(value);
    const statusCode = Number(value);
    // Keep the invalid value in the field so the user can finish typing, but
    // never persist it: the model rejects non-finite codes.
    if (!/^\d{3}$/.test(value) || statusCode < 100 || statusCode > 999) {
      setStatusCodeError('Enter an HTTP status code between 100 and 999');
      return;
    }
    setStatusCodeError('');
    patchResponse({ statusCode });
  };

  // Keep the draft in sync when the code changes elsewhere (for example when a
  // Try it response is applied onto the example).
  useEffect(() => {
    setStatusCodeDraft(String(example.response.statusCode));
  }, [example.response.statusCode]);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(PREVIEW_MODE_FRIENDLY);
  const { steps } = useExecutionState({ requestId: isSending ? example._id : undefined });

  // Switch to the actual response when a new send completes
  useEffect(() => {
    if (tryItResult) {
      setView('actual');
    }
  }, [tryItResult]);

  const cannedBody = example.response.body;
  const cannedContentType = example.response.headers.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
  // Examples travel with the collection (git history, exports), so warn while
  // the body is being typed instead of only when saving a live response.
  const cannedBodyBytes = new TextEncoder().encode(cannedBody).length;
  const isCannedBodyLarge = cannedBodyBytes > LARGE_EXAMPLE_RESPONSE_MB * 1024 * 1024;

  const patchResponse = (patch: Partial<Example['response']>) => {
    // Submit only the changed keys — the mutation shallow-merges onto the
    // current snapshot.
    updateExample.mutate({ exampleId: example._id, parentId: example.parentId, patch: { response: patch } });
  };

  const applyActualResponse = () => {
    // A failed send has no status/headers/body; applying it would overwrite the
    // canned response with an empty one.
    if (!tryItResult || tryItResult.error) {
      return;
    }
    // Session and derived headers are not part of a canned example.
    const headers = (tryItResult.headers || []).filter(
      header => !models.example.EXAMPLE_RESPONSE_HEADER_DENYLIST.includes(header.name.toLowerCase()),
    ) as ResponseHeader[];
    updateExample.mutate({
      exampleId: example._id,
      parentId: example.parentId,
      patch: {
        response: {
          statusCode: tryItResult.statusCode ?? 0,
          statusMessage: tryItResult.statusMessage || '',
          headers,
          body: tryItResult.bodyBuffer ? bodyBufferToUtf8(tryItResult.bodyBuffer) : '',
        },
      },
    });
    setView('example');
  };

  if (isSending) {
    return (
      <PlaceholderResponsePane>
        <ResponseTimer
          handleCancel={() => cancelRequestById(example._id)}
          activeRequestId={example._id}
          steps={steps}
        />
      </PlaceholderResponsePane>
    );
  }

  const timeline = parseTimeline(tryItResult?.timeline);

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="flex w-full items-center justify-between gap-2">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            {view === 'actual' && tryItResult ? (
              <>
                <StatusTag statusCode={tryItResult.statusCode || 0} statusMessage={tryItResult.statusMessage || ''} />
                <TimeTag milliseconds={tryItResult.elapsedTime || 0} steps={[]} />
                <SizeTag
                  bytesRead={tryItResult.bodyBuffer?.length || 0}
                  bytesContent={tryItResult.bodyBuffer?.length || 0}
                />
              </>
            ) : (
              <StatusTag statusCode={example.response.statusCode} statusMessage={example.response.statusMessage} />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 pr-2">
            {view === 'actual' && tryItResult && !tryItResult.error && (
              <Button
                className="rounded-xs bg-(--hl-sm) px-3 py-1 text-sm text-(--color-font) hover:bg-(--hl-xs) focus:bg-(--hl-xs)"
                onPress={applyActualResponse}
              >
                Update Example Response
              </Button>
            )}
            {tryItResult && (
              <div className="flex overflow-hidden rounded-xs border border-solid border-(--hl-md)">
                <Button
                  className="px-3 py-1 text-sm aria-pressed:bg-(--hl-sm)"
                  aria-pressed={view === 'example'}
                  onPress={() => setView('example')}
                >
                  Saved
                </Button>
                <Button
                  className="px-3 py-1 text-sm aria-pressed:bg-(--hl-sm)"
                  aria-pressed={view === 'actual'}
                  onPress={() => setView('actual')}
                >
                  Actual
                </Button>
              </div>
            )}
          </div>
        </div>
      </PaneHeader>
      <PaneBody>
        {view === 'example' || !tryItResult ? (
          <Tabs key="canned" aria-label="Example response config" className="flex h-full w-full flex-1 flex-col">
            <TabList
              className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
              aria-label="Example response tabs"
            >
              <Tab
                className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="body"
              >
                Body
              </Tab>
              <Tab
                className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="headers"
              >
                Headers
              </Tab>
              <Tab
                className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="status"
              >
                Status
              </Tab>
            </TabList>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="body">
              {isCannedBodyLarge && (
                <p className="pad-left" style={{ color: 'var(--color-warning)' }}>
                  This body is {(cannedBodyBytes / 1024 / 1024).toFixed(1)} MB (over the {LARGE_EXAMPLE_RESPONSE_MB} MB
                  guideline). It is stored in the example and included in Git history and exports.
                </p>
              )}
              <CodeEditor
                id="example-response-body-editor"
                key={example._id}
                historyKey={`example-response-body-editor::${example._id}`}
                showPrettifyButton
                defaultValue={cannedBody}
                onChange={body => patchResponse({ body })}
                mode={cannedContentType}
                placeholder="..."
                enableNunjucks
              />
            </TabPanel>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="headers">
              <KeyValueEditor
                alwaysShowBlankRow
                namePlaceholder="header"
                valuePlaceholder="value"
                descriptionPlaceholder="description"
                pairs={example.response.headers}
                onChange={headers => patchResponse({ headers: headers as ResponseHeader[] })}
              />
            </TabPanel>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="status">
              <div className="w-full px-4">
                <div className="form-row">
                  <div className="form-control form-control--outlined">
                    <label htmlFor="example-response-status-code-editor">
                      <small>Status Code</small>
                      <input
                        key={example._id}
                        id="example-response-status-code-editor"
                        type="text"
                        inputMode="numeric"
                        value={statusCodeDraft}
                        aria-invalid={Boolean(statusCodeError)}
                        aria-describedby={statusCodeError ? 'example-response-status-code-error' : undefined}
                        onChange={e => changeStatusCode(e.currentTarget.value)}
                        placeholder="200"
                      />
                    </label>
                    {statusCodeError ? (
                      <p id="example-response-status-code-error" className="pad-left" style={{ color: 'var(--color-danger)' }}>
                        {statusCodeError}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-control form-control--outlined">
                    <label htmlFor="example-response-status-message-editor">
                      <small>Status Message</small>
                      <input
                        key={example._id}
                        id="example-response-status-message-editor"
                        type="string"
                        defaultValue={example.response.statusMessage}
                        onChange={e => patchResponse({ statusMessage: e.currentTarget.value })}
                        placeholder={RESPONSE_CODE_REASONS[example.response.statusCode || 200] || 'Unknown'}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </TabPanel>
          </Tabs>
        ) : (
          <Tabs key="actual" aria-label="Actual response" className="flex h-full w-full flex-1 flex-col">
            <TabList
              className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
              aria-label="Actual response tabs"
            >
              <Tab
                className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="preview"
              >
                Preview
              </Tab>
              <Tab
                className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="headers"
              >
                Headers
              </Tab>
              <Tab
                className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="timeline"
              >
                Console
              </Tab>
            </TabList>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="preview">
              <div className="flex h-(--line-height-sm) w-full shrink-0 items-center border-b border-solid border-(--hl-md) px-2">
                <Dropdown
                  aria-label="Preview Mode Dropdown"
                  triggerButton={
                    <Button className="text-(--hl)">
                      {getPreviewModeName(previewMode)}
                      <i className="fa fa-caret-down space-left" />
                    </Button>
                  }
                >
                  {PREVIEW_MODES.map(mode => (
                    <DropdownItem key={mode} aria-label={getPreviewModeName(mode, true)}>
                      <ItemContent
                        icon={previewMode === mode ? 'check' : 'empty'}
                        label={getPreviewModeName(mode, true)}
                        onClick={() => setPreviewMode(mode)}
                      />
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>
              {tryItResult && (
                <ResponseViewer
                  key={example._id + (tryItResult.elapsedTime || 0)}
                  bytes={tryItResult.bodyBuffer?.length || 0}
                  contentType={tryItResult.contentType || ''}
                  disableHtmlPreviewJs={settings.disableHtmlPreviewJs}
                  disablePreviewLinks={settings.disableResponsePreviewLinks}
                  download={() => {}}
                  editorFontSize={settings.editorFontSize}
                  error={tryItResult.error}
                  filter={''}
                  filterHistory={[]}
                  bodyBuffer={tryItResult.bodyBuffer}
                  previewMode={previewMode}
                  responseId={example._id}
                  url={tryItResult.url || ''}
                />
              )}
            </TabPanel>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="headers">
              <ResponseHeadersViewer headers={(tryItResult?.headers || []) as ResponseHeader[]} />
            </TabPanel>
            <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="timeline">
              <ResponseTimelineViewer
                key={example._id + String(tryItResult?.elapsedTime)}
                timeline={timeline}
                pinToBottom
              />
            </TabPanel>
          </Tabs>
        )}
      </PaneBody>
    </Pane>
  );
};
