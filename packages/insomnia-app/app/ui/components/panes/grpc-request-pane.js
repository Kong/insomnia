// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import GrpcMethodDropdown from '../dropdowns/grpc-method-dropdown';
import GrpcTabbedMessages from '../viewers/grpc-tabbed-messages';
import OneLineEditor from '../codemirror/one-line-editor';
import type { Settings } from '../../../models/settings';

type Props = {
  handleRender: Function,
  handleGetRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  workspace: Workspace,
  settings: Settings,
};

const GrpcRequestPane = (props: Props) => {
  const {
    handleRender,
    handleGetRenderContext,
    nunjucksPowerUserMode,
    isVariableUncovered,
    workspace,
    settings,
  } = props;

  const demoRequestMessages = [
    { id: '2', created: 1604589843467, text: '{"greeting": "Hello Stream 2"}' },
    { id: '3', created: 1604589843468, text: '{"greeting": "Hello Stream 3"}' },
    { id: '1', created: 1604589843466, text: '{"greeting": "Hello Stream 1"}' },
  ];
  demoRequestMessages.sort((a, b) => a.created - b.created);

  return (
    <Pane type="request">
      <PaneHeader className="grpc-urlbar">
        <div className="method-grpc pad">gRPC</div>
        <form className={'form-control form-control--outlined'}>
          <OneLineEditor
            render={handleRender}
            forceEditor
            type="text"
            getRenderContext={handleGetRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            defaultValue={'grpcb.in:9000'}
            onChange={value => console.log(value)}
          />
        </form>
        <GrpcMethodDropdown />
        <button
          type="button"
          key="cancel-interval"
          className="urlbar__send-btn"
          onClick={() => console.log('Send it!')}>
          Start
        </button>
      </PaneHeader>
      <PaneBody>
        <Tabs className={'react-tabs'}>
          <TabList>
            <Tab>
              <button>Client Streaming</button>
            </Tab>
            <Tab>
              <button>Headers</button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel">
            <GrpcTabbedMessages
              showBodyTab
              showTabActions
              settings={settings}
              workspace={workspace}
              handleRender={handleRender}
              isVariableUncovered={isVariableUncovered}
              nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
              messages={demoRequestMessages}
              bodyText={'{"greeting": "Hello Body Text"}'}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel">
            <h4 className="pad">Coming soon! 😊</h4>
          </TabPanel>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};

export default GrpcRequestPane;
