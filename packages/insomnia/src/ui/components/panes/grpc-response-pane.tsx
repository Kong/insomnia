import React, { FunctionComponent } from 'react';

import { GrpcRequestState } from '../../routes/debug';
import { TabItem, Tabs } from '../base/tabs';
import { CodeEditor } from '../codemirror/code-editor';
import { GrpcStatusTag } from '../tags/grpc-status-tag';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  grpcState: GrpcRequestState;
}

export const GrpcResponsePane: FunctionComponent<Props> = ({ grpcState: { running, responseMessages, status, error } }) => {
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
          ? (<Tabs aria-label="Grpc tabbed messages tabs" isNested>
            {responseMessages.sort((a, b) => a.created - b.created).map((m, index) => (
              <TabItem key={m.id} title={`Response ${index + 1}`}>
                <CodeEditor
                  id="grpc-response"
                  defaultValue={m.text}
                  mode="application/json"
                  enableNunjucks
                  readOnly
                  autoPrettify
                />
              </TabItem>))}
          </Tabs>)
          : null
        }
      </PaneBody>
    </Pane>
  );
};
