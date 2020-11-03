// @flow
import React from 'react';
import { Pane, paneBodyClasses, PaneBody, PaneHeader } from './pane';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import classnames from 'classnames';
import Button from '../base/button';
import GRPCEditor from '../editors/grpc-editor';
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

  return (
    <Pane type="request">
      <PaneHeader>
        <div className="method-grpc pad">gRPC</div>
        <div className="urlbar">
          <form className={'form-control'}>
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
            <button
              type="button"
              key="cancel-interval"
              className="urlbar__send-btn"
              onClick={() => console.log('Send it!')}>
              Start
            </button>
          </form>
        </div>
      </PaneHeader>
      <PaneBody>
        <Tabs className={classnames(paneBodyClasses, 'react-tabs')}>
          <TabList>
            <Tab>
              <button>Client Streaming</button>
            </Tab>
            <Tab>
              <button>Headers</button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel">
            <Tabs className={classnames(paneBodyClasses, 'react-tabs', 'react-tabs--nested')}>
              <div className="tab-action-wrapper">
                <div className="tab-action-tabs">
                  <TabList>
                    <Tab>
                      <button>Body</button>
                    </Tab>
                    <Tab>
                      <button>Stream 1</button>
                    </Tab>
                    <Tab>
                      <button>Stream 2</button>
                    </Tab>
                    <Tab>
                      <button>Stream 3</button>
                    </Tab>
                    <Tab>
                      <button>Stream 4</button>
                    </Tab>
                    <Tab>
                      <button>Stream 5</button>
                    </Tab>
                  </TabList>
                </div>
                <div className="">
                  <Button className="btn btn--compact btn--clicky margin-sm bg-default">
                    Stream <i className="fa fa-plus" />
                  </Button>
                  <Button className="btn btn--compact btn--clicky margin-sm bg-surprise">
                    Commit <i className="fa fa-arrow-right" />
                  </Button>
                </div>
              </div>
              <TabPanel className="react-tabs__tab-panel editor-wrapper">
                <GRPCEditor
                  uniquenessKey="123"
                  content={'{"greeting": "Hello 1"}'}
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
              <TabPanel className="react-tabs__tab-panel editor-wrapper">
                <GRPCEditor
                  uniquenessKey="1234"
                  content={'{"greeting": "Hello 2"}'}
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
              <TabPanel className="react-tabs__tab-panel editor-wrapper">
                <GRPCEditor
                  uniquenessKey="1235"
                  content={'{"greeting": "Hello 3"}'}
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
              <TabPanel className="react-tabs__tab-panel editor-wrapper">
                <GRPCEditor
                  uniquenessKey="1236"
                  content={'{"greeting": "Hello 4"}'}
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
              <TabPanel className="react-tabs__tab-panel editor-wrapper">
                <GRPCEditor
                  uniquenessKey="1237"
                  content={'{"greeting": "Hello 5"}'}
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
              <TabPanel className="react-tabs__tab-panel editor-wrapper">
                <GRPCEditor
                  uniquenessKey="1238"
                  content={'{"greeting": "Hello 6"}'}
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
            </Tabs>
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
