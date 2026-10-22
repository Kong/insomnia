import type { Example, ResponseHeader } from 'insomnia-data';
import { RESPONSE_CODE_REASONS } from 'insomnia-data/common';
import { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { LARGE_EXAMPLE_RESPONSE_MB } from '~/common/constants';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { KeyValueEditor } from '~/ui/components/key-value-editor/key-value-editor';
import { Pane, PaneBody, PaneHeader } from '~/ui/components/panes/pane';
import { StatusTag } from '~/ui/components/tags/status-tag';
import { useUpdateExample } from '~/ui/hooks/use-example-mutations';

interface ExampleResponsePaneProps {
  example: Example;
}

export const ExampleResponsePane = ({ example }: ExampleResponsePaneProps) => {
  const updateExample = useUpdateExample();

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

  // Keep the draft in sync when the code changes elsewhere (for example after a
  // Try it response is applied onto the example).
  useEffect(() => {
    setStatusCodeDraft(String(example.response.statusCode));
  }, [example.response.statusCode]);

  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="flex w-full items-center justify-between gap-2">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={example.response.statusCode} statusMessage={example.response.statusMessage} />
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
      </PaneBody>
    </Pane>
  );
};
