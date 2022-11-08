import React, { FunctionComponent } from 'react';

import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { TabItem, Tabs } from '../base/tabs';
import { GRPCEditor } from '../editors/grpc-editor';

interface Message {
  id: string;
  created: number;
  text: string;
}

interface Props {
  messages?: Message[];
  tabNamePrefix: 'Stream' | 'Response';
  bodyText?: string;
  uniquenessKey: string;
  handleBodyChange?: (arg0: string) => Promise<void>;
  handleStream?: () => void;
  handleCommit?: () => void;
  showActions?: boolean;
  handleRender?: HandleRender;
  handleGetRenderContext?: HandleGetRenderContext;
}

export const GrpcTabbedMessages: FunctionComponent<Props> = ({
  showActions,
  bodyText,
  messages,
  tabNamePrefix,
  handleBodyChange,
  handleCommit,
  handleStream,
  uniquenessKey,
}) => {
  const shouldShowBody = !!handleBodyChange;
  const orderedMessages = messages?.sort((a, b) => a.created - b.created) || [];
  return (
    <Tabs key={uniquenessKey}>
      <div className='tab-action-wrapper'>
        <div className='tab-action-tabs'>
          {shouldShowBody &&
            <TabItem key="body" title="Body">
              <GRPCEditor content={bodyText} handleChange={handleBodyChange} />
            </TabItem>}
          {orderedMessages?.map((m, index) => (
            <TabItem key={m.id} title={`${tabNamePrefix} ${index + 1}`}>
              <GRPCEditor content={m.text} readOnly />
            </TabItem>
          ))}
        </div>
        {showActions && (
          <>
            {handleStream && (
              <button
                className='btn btn--compact btn--clicky margin-sm bg-default'
                onClick={handleStream}
              >
                Stream <i className='fa fa-plus' />
              </button>
            )}
            {handleCommit && (
              <button
                className='btn btn--compact btn--clicky margin-sm bg-surprise'
                onClick={handleCommit}
              >
                Commit <i className='fa fa-arrow-right' />
              </button>
            )}
          </>
        )}
      </div>
    </Tabs>
  );
};
