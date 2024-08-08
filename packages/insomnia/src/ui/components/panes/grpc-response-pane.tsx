import React, { type FunctionComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import type { GrpcRequestState } from '../../routes/debug';
import { CodeEditor } from '../codemirror/code-editor';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  grpcState: GrpcRequestState;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({ grpcState: { running, responseMessages, status, error } }) => {
  const messageTabs = responseMessages.map((m, index) => ({ id: m.id, text: m.text, name: `Response ${index + 1}` }));
  return (
    <Pane type="response">
      <PaneHeader className="row-spaced">
        <div className="no-wrap scrollable scrollable--no-bars pad-left">
          {running && <i className='fa fa-refresh fa-spin margin-right-sm' />}
          {status && <GrpcStatusTag statusCode={status.code} statusMessage={status.details} />}
          {!status && error && <GrpcStatusTag statusMessage={error.message} />}
        </div>
      </PaneHeader>
      <PaneBody >
        {responseMessages.length
          ? (
            <Tabs aria-label="Grpc tabbed messages tabs" className="flex-1 w-full h-full flex flex-col">
              <TabList items={messageTabs} className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]'>
                {item => (
                  <Tab
                    className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                    id={item.id}
                  >
                    {item.name}
                  </Tab>
                )}
              </TabList>
              {messageTabs.filter(msg => msg.id !== 'body').map(m => (
                <TabPanel key={m.id} id={m.id} className='w-full h-full overflow-y-auto'>
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
          )
          : null
        }
      </PaneBody>
    </Pane>
  );
};
