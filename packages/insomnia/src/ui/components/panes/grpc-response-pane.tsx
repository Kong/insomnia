import React, { type FunctionComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import type { GrpcRequestState } from '../../routes/debug';
import { CodeEditor } from '../codemirror/code-editor';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  grpcState: GrpcRequestState;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({
  grpcState: { running, responseMessages, status, error },
}) => {
  const messageTabs = responseMessages.map((m, index) => ({ id: m.id, text: m.text, name: `Response ${index + 1}` }));
  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          {running && <i className="fa fa-refresh fa-spin margin-right-sm" />}
          {status && <GrpcStatusTag statusCode={status.code} statusMessage={status.details} />}
          {!status && error && <GrpcStatusTag statusMessage={error.message} />}
        </div>
      </PaneHeader>
      <PaneBody>
        {responseMessages.length ? (
          <Tabs aria-label="Grpc tabbed messages tabs" className="flex h-full w-full flex-1 flex-col">
            <TabList
              items={messageTabs}
              className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
            >
              {item => (
                <Tab
                  className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                  id={item.id}
                >
                  {item.name}
                </Tab>
              )}
            </TabList>
            {messageTabs
              .filter(msg => msg.id !== 'body')
              .map(m => (
                <TabPanel key={m.id} id={m.id} className="h-full w-full overflow-y-auto">
                  <CodeEditor
                    id={'grpc-request-editor-tab' + m.id}
                    defaultValue={m.text}
                    mode="application/json"
                    enableNunjucks
                    readOnly
                    autoPrettify
                  />
                </TabPanel>
              ))}
          </Tabs>
        ) : null}
      </PaneBody>
    </Pane>
  );
};
