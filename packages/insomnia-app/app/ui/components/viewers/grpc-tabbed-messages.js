// @flow
import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import classnames from 'classnames';
import GRPCEditor from '../editors/grpc-editor';
import Button from '../base/button';

type Message = {
  id: string,
  created: number,
  text: string,
};

type Props = {
  settings: Settings,
  messages: ?Array<Message>,
  tabNamePrefix: 'Stream' | 'Response',
  bodyText: string,
  uniquenessKey: string,

  handleBodyChange?: string => Promise<void>,
  handleStream?: () => void,
  handleCommit?: () => void,
  showActions?: boolean,
};

const GrpcTabbedMessages = ({
  settings,
  showActions,
  bodyText,
  messages,
  tabNamePrefix,
  handleBodyChange,
  handleCommit,
  handleStream,
  uniquenessKey,
}: Props) => {
  const shouldShowBody = !!handleBodyChange;

  const orderedMessages = messages?.sort((a, b) => a.created - b.created) || [];

  return (
    <Tabs key={uniquenessKey} className={classnames('react-tabs', 'react-tabs--nested')}>
      <div className="tab-action-wrapper">
        <div className="tab-action-tabs">
          <TabList>
            {shouldShowBody && (
              <Tab>
                <button>Body</button>
              </Tab>
            )}
            {messages?.map((m, index) => (
              <Tab key={m.id}>
                <button>
                  {tabNamePrefix} {index + 1}
                </button>
              </Tab>
            ))}
          </TabList>
        </div>
        {showActions && (
          <>
            {handleStream && (
              <Button
                className="btn btn--compact btn--clicky margin-sm bg-default"
                onClick={handleStream}>
                Stream <i className="fa fa-plus" />
              </Button>
            )}
            {handleCommit && (
              <Button
                className="btn btn--compact btn--clicky margin-sm bg-surprise"
                onClick={handleCommit}>
                Commit <i className="fa fa-arrow-right" />
              </Button>
            )}
          </>
        )}
      </div>
      {shouldShowBody && (
        <TabPanel className="react-tabs__tab-panel editor-wrapper">
          <GRPCEditor content={bodyText} settings={settings} handleChange={handleBodyChange} />
        </TabPanel>
      )}
      {orderedMessages.map(m => (
        <TabPanel key={m.id} className="react-tabs__tab-panel editor-wrapper">
          <GRPCEditor content={m.text} settings={settings} readOnly />
        </TabPanel>
      ))}
    </Tabs>
  );
};

export default GrpcTabbedMessages;
