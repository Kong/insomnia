import { models } from 'insomnia-data';
import { RESPONSE_CODE_REASONS } from 'insomnia-data/common';
import { useEffect, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { ExampleResponseHeadersEditor } from '~/ui/components/examples/example-response-headers-editor';
import { Pane, PaneBody, PaneHeader } from '~/ui/components/panes/pane';
import { StatusTag } from '~/ui/components/tags/status-tag';
import { useExampleEditorContext } from '~/ui/context/example-editor-context';
import { useDebouncedCallback } from '~/ui/hooks/use-debounced-callback';

const { MAX_EXAMPLE_RESPONSE_BODY_BYTES, isExampleResponseBodyWithinLimit } = models.example;

export const ExampleResponsePane = () => {
  const { exampleId, response, patchResponse } = useExampleEditorContext()!;

  const cannedBody = response.body;
  const cannedContentType = response.headers.find(h => h.name.toLowerCase() === 'content-type')?.value || '';

  // The stored body is always within the limit (the service refuses larger
  // writes), so only the draft being typed can exceed it. Track the fact rather
  // than a byte count: an exact UTF-8 count has to encode the whole body, which
  // is only needed in the band where the count can cross the limit (a UTF-8
  // size is between the code-unit length and three times it).
  const [isDraftBodyTooLarge, setIsDraftBodyTooLarge] = useState(() => !isExampleResponseBodyWithinLimit(cannedBody));

  // The body can be large; persist it once the typing pauses rather than
  // rewriting the whole example document on every keystroke.
  const writeCannedBody = useDebouncedCallback((body: string) => patchResponse({ body }));
  // The status message is free text too, and every write rewrites the whole
  // document, so it follows the same rule as the body.
  const writeStatusMessage = useDebouncedCallback((statusMessage: string) => patchResponse({ statusMessage }));

  // A controlled draft: switching the response tab unmounts the panel, and an
  // uncontrolled input would come back with the old persisted value while the
  // debounced write is still in flight. Values this editor typed are remembered
  // (never consumed) so their echoes — optimistic, authoritative and db-change —
  // do not reset the draft.
  const [statusMessageDraft, setStatusMessageDraft] = useState(response.statusMessage);
  const sentStatusMessagesRef = useRef(new Set([response.statusMessage]));
  const changeStatusMessage = (statusMessage: string) => {
    setStatusMessageDraft(statusMessage);
    sentStatusMessagesRef.current.add(statusMessage);
    if (sentStatusMessagesRef.current.size > 10) {
      const [oldest] = sentStatusMessagesRef.current;
      sentStatusMessagesRef.current.delete(oldest);
    }
    writeStatusMessage(statusMessage);
  };
  useEffect(() => {
    const incoming = response.statusMessage;
    if (!sentStatusMessagesRef.current.has(incoming)) {
      setStatusMessageDraft(incoming);
    }
  }, [response.statusMessage]);

  const handleBodyChange = (body: string) => {
    const tooLarge =
      body.length > MAX_EXAMPLE_RESPONSE_BODY_BYTES ||
      (body.length * 3 > MAX_EXAMPLE_RESPONSE_BODY_BYTES && !isExampleResponseBodyWithinLimit(body));
    setIsDraftBodyTooLarge(tooLarge);
    if (tooLarge) {
      return;
    }
    writeCannedBody(body);
  };

  const [statusCodeDraft, setStatusCodeDraft] = useState(String(response.statusCode));
  const [statusCodeError, setStatusCodeError] = useState('');

  const changeStatusCode = (value: string) => {
    setStatusCodeDraft(value);
    const statusCode = Number(value);
    // Keep the invalid value in the field so the user can finish typing, but
    // never persist it: the model rejects non-finite codes.
    if (!/^\d{3}$/.test(value) || statusCode < 100 || statusCode > 999) {
      setStatusCodeError('Enter a status code between 100 and 999');
      return;
    }
    setStatusCodeError('');
    patchResponse({ statusCode });
  };

  // Both text inputs in this panel are controlled drafts, so a change made
  // elsewhere (another window, a git pull) is mirrored instead of silently
  // overwritten on the next keystroke.
  useEffect(() => {
    setStatusCodeDraft(String(response.statusCode));
  }, [response.statusCode]);

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="flex w-full items-center justify-between gap-2">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
          </div>
        </div>
      </PaneHeader>
      <PaneBody>
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
            {isDraftBodyTooLarge && (
              <p className="pad-left pb-2 text-(--color-danger)">
                This body is over the {MAX_EXAMPLE_RESPONSE_BODY_BYTES / 1024 / 1024} MB limit for a stored example.
                Changes are not saved until it is smaller; examples are kept in Git history and cloud snapshots, so the
                limit applies to every write.
              </p>
            )}
            <CodeEditor
              id="example-response-body-editor"
              historyKey={`example-response-body-editor::${exampleId}`}
              showPrettifyButton
              defaultValue={cannedBody}
              onChange={handleBodyChange}
              mode={cannedContentType}
              placeholder="..."
              enableNunjucks
            />
          </TabPanel>
          <TabPanel className="relative flex w-full flex-1 flex-col overflow-hidden" id="headers">
            <ExampleResponseHeadersEditor
              headers={response.headers}
              onChange={headers => patchResponse({ headers })}
            />
          </TabPanel>
          <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="status">
            <div className="w-full px-4">
              <div className="form-row">
                <div className="form-control form-control--outlined">
                  <label htmlFor="example-response-status-code-editor">
                    <small>Status Code</small>
                  </label>
                  <input
                    id="example-response-status-code-editor"
                    type="text"
                    inputMode="numeric"
                    value={statusCodeDraft}
                    aria-invalid={Boolean(statusCodeError)}
                    aria-describedby={statusCodeError ? 'example-response-status-code-error' : undefined}
                    onChange={e => changeStatusCode(e.currentTarget.value)}
                    placeholder="200"
                  />
                  {statusCodeError ? (
                    <p
                      id="example-response-status-code-error"
                      className="mt-1 text-xs text-(--color-danger)"
                    >
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
                      id="example-response-status-message-editor"
                      type="text"
                      value={statusMessageDraft}
                      onChange={e => changeStatusMessage(e.currentTarget.value)}
                      placeholder={RESPONSE_CODE_REASONS[response.statusCode || 200] || 'Unknown'}
                    />
                  </label>
                </div>
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};
