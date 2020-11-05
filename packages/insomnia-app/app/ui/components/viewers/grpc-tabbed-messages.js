// @flow
import React from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { paneBodyClasses } from '../panes/pane';
import classnames from 'classnames';
import GRPCEditor from '../editors/grpc-editor';
import Button from '../base/button';

type Message = {
  id: string,
  created: number,
  text: string,
};

type Props = {
  handleRender: Function,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  workspace: Workspace,
  settings: Settings,
  showTabActions: boolean,
  bodyText: string,
  messages: Array<Message>,
};

// Stubbed > sorted messages
const demoMessages = [
  { id: '2', created: 1604589843467, text: '{"greeting": "Hello 2"}' },
  { id: '3', created: 1604589843468, text: '{"greeting": "Hello 3"}' },
  { id: '1', created: 1604589843466, text: '{"greeting": "Hello 1"}' },
];
demoMessages.sort((a, b) => a.created - b.created);

const GrpcTabbedMessages = (props: Props) => {
  const {
    handleRender,
    isVariableUncovered,
    workspace,
    settings,
    showTabActions,
    bodyText,
  } = props;

  return (
    <Tabs className={classnames(paneBodyClasses, 'react-tabs', 'react-tabs--nested')}>
      <div className="tab-action-wrapper">
        <div className="tab-action-tabs">
          <TabList>
            {showTabActions && (
              <Tab>
                <button>Body</button>
              </Tab>
            )}
            {demoMessages.map((message, index) => (
              <Tab key={message.id}>
                <button>Stream {index + 1}</button>
              </Tab>
            ))}
          </TabList>
        </div>
        {showTabActions && (
          <div>
            <Button className="btn btn--compact btn--clicky margin-sm bg-default">
              Stream <i className="fa fa-plus" />
            </Button>
            <Button className="btn btn--compact btn--clicky margin-sm bg-surprise">
              Commit <i className="fa fa-arrow-right" />
            </Button>
          </div>
        )}
      </div>
      {showTabActions && (
        <TabPanel className="react-tabs__tab-panel editor-wrapper">
          <GRPCEditor
            uniquenessKey="123"
            content={bodyText}
            contentType={'application/json'}
            fontSize={props.settings.editorFontSize}
            indentSize={settings.editorIndentSize}
            keyMap={settings.editorKeyMap}
            lineWrapping={settings.editorLineWrapping}
            indentWithTabs={settings.editorIndentWithTabs}
            settings={settings}
            workspace={workspace}
            handleRender={handleRender}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            onChange={value => console.log(value)}
          />
        </TabPanel>
      )}
      {demoMessages.map(message => (
        <TabPanel key={message.id} className="react-tabs__tab-panel editor-wrapper">
          <GRPCEditor
            readOnly
            uniquenessKey={message.id}
            content={message.text}
            contentType={'application/json'}
            fontSize={settings.editorFontSize}
            indentSize={settings.editorIndentSize}
            keyMap={settings.editorKeyMap}
            lineWrapping={settings.editorLineWrapping}
            indentWithTabs={settings.editorIndentWithTabs}
            settings={settings}
            workspace={workspace}
            handleRender={handleRender}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            onChange={value => console.log(value)}
          />
        </TabPanel>
      ))}
    </Tabs>
  );
};

export default GrpcTabbedMessages;
