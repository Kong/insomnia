import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

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

const ActionButtonsContainer = styled.div({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-end',
  boxSizing: 'border-box',
  height: 'var(--line-height-sm)',
  borderBottom: '1px solid var(--hl-lg)',
  padding: 3,
});

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

  const tabItems = [];

  if (shouldShowBody) {
    tabItems.push(
      <TabItem key="body" title="Body">
        <GRPCEditor content={bodyText} handleChange={handleBodyChange} />
      </TabItem>
    );
  }

  orderedMessages.map((m, index) => tabItems.push(
    <TabItem key={m.id} title={`${tabNamePrefix} ${index + 1}`}>
      <GRPCEditor content={m.text} readOnly />
    </TabItem>
  ));

  return (
    <>
      {showActions && (
        <ActionButtonsContainer>
          {handleStream && (
            <button
              className='btn btn--compact btn--clicky-small margin-left-sm bg-default'
              onClick={handleStream}
            >
              Stream <i className='fa fa-plus' />
            </button>
          )}
          {handleCommit && (
            <button
              className='btn btn--compact btn--clicky-small margin-left-sm bg-surprise'
              onClick={handleCommit}
            >
              Commit <i className='fa fa-arrow-right' />
            </button>
          )}
        </ActionButtonsContainer>
      )}
      <Tabs key={uniquenessKey} aria-label="Grpc tabbed messages tabs" isNested>
        {tabItems}
      </Tabs>
    </>
  );
};
