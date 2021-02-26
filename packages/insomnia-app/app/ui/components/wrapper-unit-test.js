// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG, ACTIVITY_HOME } from '../../common/constants';
import classnames from 'classnames';
import PageLayout from './page-layout';
import {
  Button,
  Dropdown,
  DropdownItem,
  ListGroup,
  UnitTestItem,
  UnitTestResultItem,
} from 'insomnia-components';
import UnitTestEditable from './unit-test-editable';
import ErrorBoundary from './error-boundary';
import CodeEditor from './codemirror/code-editor';
import type { WrapperProps } from './wrapper';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import { generate, runTests } from 'insomnia-testing';
import { showAlert, showModal, showPrompt } from './modals';
import Editable from './base/editable';
import type { SidebarChildObjects } from './sidebar/sidebar-children';
import SelectModal from './modals/select-modal';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { getSendRequestCallback } from '../../common/send-request';
import type { GlobalActivity } from '../../common/constants';
import WorkspacePageHeader from './workspace-page-header';
import { trackSegmentEvent } from '../../common/analytics';

type Props = {|
  children: SidebarChildObjects,
  gitSyncDropdown: React.Node,
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>,
  wrapperProps: WrapperProps,
|};

type State = {|
  testsRunning: Array<UnitTest> | null,
  resultsError: string | null,
|};

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperUnitTest extends React.PureComponent<Props, State> {
  state = {
    testsRunning: null,
    resultsError: null,
  };

  // Defining it here instead of in render() so it won't act as a changed prop
  // when being passed to <CodeEditor> again
  static lintOptions = {
    globals: {
      // https://jshint.com/docs/options/
      insomnia: true,
      expect: true,
      chai: true,
      debugger: true,
    },
    asi: true, // Don't require semicolons
    undef: true, // Prevent undefined usages
    node: true, // Enable NodeJS globals
    esversion: 8, // ES8 syntax (async/await, etc)
  };

  generateSendReqSnippet(existingCode: string, requestId: string): string {
    let variableName = 'response';

    for (let i = 1; i < 100; i++) {
      variableName = `response${i}`;

      // Try next one if code already contains this variable
      if (existingCode.includes(`const ${variableName} =`)) {
        continue;
      }

      // Found variable that doesn't exist in code yet
      break;
    }

    return (
      `const ${variableName} = await insomnia.send(${requestId});\n` +
      `expect(${variableName}.status).to.equal(200);`
    );
  }

  autocompleteSnippets(unitTest: UnitTest): Array<{ name: string, value: () => Promise<string> }> {
    return [
      {
        name: 'Send Current Request',
        displayValue: '',
        value: this.generateSendReqSnippet(unitTest.code, ''),
      },
      {
        name: 'Send Request By ID',
        displayValue: '',
        value: async () => {
          return new Promise(resolve => {
            showModal(SelectModal, {
              title: 'Select Request',
              message: 'Select a request to fill',
              value: '__NULL__',
              options: [
                { name: '-- Select Request --', value: '__NULL__' },
                ...this.buildSelectableRequests().map(({ name, request }) => ({
                  name: name,
                  displayValue: '',
                  value: this.generateSendReqSnippet(unitTest.code, `'${request._id}'`),
                })),
              ],
              onDone: v => resolve(v),
            });
          });
        },
      },
    ];
  }

  async _handleCreateTestSuite(): Promise<void> {
    const { activeWorkspace } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test Suite',
      defaultValue: 'New Suite',
      submitName: 'Create Suite',
      label: 'Test Suite Name',
      selectText: true,
      onComplete: async name => {
        const unitTestSuite = await models.unitTestSuite.create({
          parentId: activeWorkspace._id,
          name,
        });
        await this._handleSetActiveUnitTestSuite(unitTestSuite);
        trackSegmentEvent('Test Suite Created');
      },
    });
  }

  async _handleCreateTest(): Promise<void> {
    const { activeUnitTestSuite } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test',
      defaultValue: 'Returns 200',
      submitName: 'New Test',
      label: 'Test Name',
      selectText: true,
      onComplete: async name => {
        await models.unitTest.create({
          parentId: activeUnitTestSuite._id,
          code: this.generateSendReqSnippet('', ''),
          name,
        });
        trackSegmentEvent('Unit Test Created');
      },
    });
  }

  async _handleUnitTestCodeChange(unitTest: UnitTest, v: string): Promise<void> {
    await models.unitTest.update(unitTest, { code: v });
  }

  async _handleBreadcrumb(): void {
    const {
      handleActivityChange,
      wrapperProps: { activeWorkspace },
    } = this.props;
    await handleActivityChange(activeWorkspace._id, ACTIVITY_HOME);
  }

  async _handleRunTests(): Promise<void> {
    const { activeUnitTests } = this.props.wrapperProps;
    await this._runTests(activeUnitTests);
    trackSegmentEvent('Ran All Unit Tests');
  }

  async _handleRunTest(unitTest: UnitTest): Promise<void> {
    await this._runTests([unitTest]);
    trackSegmentEvent('Ran Individual Unit Test');
  }

  async _handleDeleteTest(unitTest: UnitTest): Promise<void> {
    showAlert({
      title: `Delete ${unitTest.name}`,
      message: (
        <span>
          Really delete <strong>{unitTest.name}</strong>?
        </span>
      ),
      addCancel: true,
      onConfirm: async () => {
        await models.unitTest.remove(unitTest);
        trackSegmentEvent('Unit Test Deleted');
      },
    });
  }

  async _handleSetActiveRequest(
    unitTest: UnitTest,
    e: SyntheticEvent<HTMLSelectElement>,
  ): Promise<void> {
    const requestId = e.currentTarget.value === '__NULL__' ? null : e.currentTarget.value;
    await models.unitTest.update(unitTest, { requestId });
  }

  async _handleDeleteUnitTestSuite(unitTestSuite: UnitTestSuite): Promise<void> {
    showAlert({
      title: `Delete ${unitTestSuite.name}`,
      message: (
        <span>
          Really delete <strong>{unitTestSuite.name}</strong>?
        </span>
      ),
      addCancel: true,
      onConfirm: async () => {
        await models.unitTestSuite.remove(unitTestSuite);
        trackSegmentEvent('Test Suite Deleted');
      },
    });
  }

  async _handleSetActiveUnitTestSuite(unitTestSuite: UnitTestSuite): Promise<void> {
    const { activeWorkspace } = this.props.wrapperProps;
    await models.workspaceMeta.updateByParentId(activeWorkspace._id, {
      activeUnitTestSuiteId: unitTestSuite._id,
    });
  }

  async _handleChangeTestName(unitTest: UnitTest, name: string): Promise<void> {
    await models.unitTest.update(unitTest, { name });
  }

  async _handleChangeActiveSuiteName(name: string): Promise<void> {
    const { activeUnitTestSuite } = this.props.wrapperProps;
    await models.unitTestSuite.update(activeUnitTestSuite, { name });
  }

  async _runTests(unitTests: Array<UnitTest>): Promise<void> {
    const { requests, activeWorkspace, activeEnvironment } = this.props.wrapperProps;

    this.setState({ testsRunning: unitTests, resultsError: null });

    const tests = [];
    for (const t of unitTests) {
      tests.push({
        name: t.name,
        code: t.code,
        defaultRequestId: t.requestId,
      });
    }

    const src = await generate([{ name: 'My Suite', suites: [], tests }]);
    const sendRequest = getSendRequestCallback(activeEnvironment ? activeEnvironment._id : null);

    let results;
    try {
      results = await runTests(src, { requests, sendRequest });
    } catch (err) {
      // Set the state after a timeout so the user still sees the loading state
      setTimeout(() => {
        this.setState({ resultsError: err.message, testsRunning: null });
      }, 400);
      return;
    }

    await models.unitTestResult.create({ results, parentId: activeWorkspace._id });

    this.setState({ testsRunning: null });
  }

  buildSelectableRequests(): Array<{ name: string, request: Request }> {
    const { children } = this.props;
    const selectableRequests: Array<{ name: string, request: Request }> = [];

    const next = (p, children) => {
      for (const c of children) {
        if (c.doc.type === models.request.type) {
          selectableRequests.push({
            name: `${p} [${c.doc.method}] ${c.doc.name}`,
            request: c.doc,
          });
        } else if (c.doc.type === models.requestGroup.type) {
          next(c.doc.name + ' / ', c.children);
        }
      }
    };

    next('', children.all);

    return selectableRequests;
  }

  _renderResults(): React.Node {
    const { activeUnitTestResult } = this.props.wrapperProps;
    const { testsRunning, resultsError } = this.state;

    if (resultsError) {
      return (
        <div className="unit-tests__results">
          <div className="unit-tests__top-header">
            <h2>Run Failed</h2>
          </div>
          <div className="danger pad">{resultsError}</div>
        </div>
      );
    }

    if (testsRunning) {
      return (
        <div className="unit-tests__results">
          <div className="unit-tests__top-header">
            <h2>Running {testsRunning.length} Tests...</h2>
          </div>
        </div>
      );
    }

    if (!activeUnitTestResult) {
      return (
        <div className="unit-tests__results">
          <div className="unit-tests__top-header">
            <h2>No Results</h2>
          </div>
        </div>
      );
    }

    if (activeUnitTestResult.results) {
      const { stats, tests } = activeUnitTestResult.results;
      return (
        <div className="unit-tests__results">
          {activeUnitTestResult && (
            <div key={activeUnitTestResult._id}>
              <div className="unit-tests__top-header">
                {stats.failures ? (
                  <h2 className="warning">
                    Tests Failed {stats.failures}/{stats.tests}
                  </h2>
                ) : (
                  <h2 className="success">
                    Tests Passed {stats.passes}/{stats.tests}
                  </h2>
                )}
              </div>
              <ListGroup>
                {tests.map((t, i) => (
                  <UnitTestResultItem key={i} item={t} />
                ))}
              </ListGroup>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="unit-tests">
        <div className="unit-tests__top-header">
          <h2 className="success">Awaiting Test Execution</h2>
        </div>
      </div>
    );
  }

  renderUnitTest(unitTest: UnitTest): React.Node {
    const { settings } = this.props.wrapperProps;
    const { testsRunning } = this.state;
    const selectableRequests = this.buildSelectableRequests();

    return (
      <UnitTestItem
        item={unitTest}
        key={unitTest._id}
        onSetActiveRequest={this._handleSetActiveRequest.bind(this, unitTest)}
        onDeleteTest={this._handleDeleteTest.bind(this, unitTest)}
        onRunTest={this._handleRunTest.bind(this, unitTest)}
        testsRunning={testsRunning}
        selectedRequestId={unitTest.requestId}
        selectableRequests={selectableRequests}
        testNameEditable={
          <UnitTestEditable
            onSubmit={this._handleChangeTestName.bind(this, unitTest)}
            value={unitTest.name}
          />
        }>
        <CodeEditor
          dynamicHeight
          manualPrettify
          fontSize={settings.editorFontSize}
          indentSize={settings.editorIndentSize}
          indentWithTabs={settings.editorIndentWithTabs}
          keyMap={settings.editorKeyMap}
          defaultValue={unitTest ? unitTest.code : ''}
          getAutocompleteSnippets={() => this.autocompleteSnippets(unitTest)}
          lintOptions={WrapperUnitTest.lintOptions}
          onChange={this._handleUnitTestCodeChange.bind(this, unitTest)}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          isVariableUncovered={settings.isVariableUncovered}
          mode="javascript"
          lineWrapping={settings.editorLineWrapping}
          placeholder=""
        />
      </UnitTestItem>
    );
  }

  _renderTestSuite(): React.Node {
    const { activeUnitTests, activeUnitTestSuite } = this.props.wrapperProps;
    const { testsRunning } = this.state;

    if (!activeUnitTestSuite) {
      return <div className="unit-tests pad theme--pane__body">No test suite selected</div>;
    }

    return (
      <div className="unit-tests theme--pane__body">
        <div className="unit-tests__top-header">
          <h2>
            <Editable
              singleClick
              onSubmit={this._handleChangeActiveSuiteName}
              value={activeUnitTestSuite.name}
            />
          </h2>
          <Button variant="outlined" onClick={this._handleCreateTest}>
            New Test
          </Button>
          <Button
            variant="contained"
            bg="surprise"
            onClick={this._handleRunTests}
            size="default"
            disabled={testsRunning}>
            {testsRunning ? 'Running... ' : 'Run Tests'}
            <i className="fa fa-play space-left"></i>
          </Button>
        </div>
        <ListGroup>{activeUnitTests.map(this.renderUnitTest)}</ListGroup>
      </div>
    );
  }

  _renderPageSidebar(): React.Node {
    const { activeUnitTestSuites, activeUnitTestSuite } = this.props.wrapperProps;
    const { testsRunning } = this.state;
    const activeId = activeUnitTestSuite ? activeUnitTestSuite._id : 'n/a';

    return (
      <ErrorBoundary showAlert>
        <div className="unit-tests__sidebar">
          <div className="pad-sm">
            <Button variant="outlined" onClick={this._handleCreateTestSuite}>
              New Test Suite
            </Button>
          </div>
          <ul>
            {activeUnitTestSuites.map(s => (
              <li key={s._id} className={classnames({ active: s._id === activeId })}>
                <button key={s._id} onClick={this._handleSetActiveUnitTestSuite.bind(this, s)}>
                  {s.name}
                </button>
                <Dropdown
                  right
                  renderButton={() => (
                    <button className="unit-tests__sidebar__action">
                      <i className="fa fa-caret-down" />
                    </button>
                  )}>
                  <DropdownItem
                    stayOpenAfterClick
                    onClick={this._handleRunTests}
                    disabled={testsRunning}>
                    {testsRunning ? 'Running... ' : 'Run Tests'}
                  </DropdownItem>
                  <DropdownItem onClick={this._handleDeleteUnitTestSuite.bind(this, s)}>
                    Delete Suite
                  </DropdownItem>
                </Dropdown>
              </li>
            ))}
          </ul>
        </div>
      </ErrorBoundary>
    );
  }

  _renderPageHeader() {
    const { wrapperProps, gitSyncDropdown, handleActivityChange } = this.props;

    return (
      <WorkspacePageHeader
        wrapperProps={wrapperProps}
        handleActivityChange={handleActivityChange}
        gridRight={gitSyncDropdown}
      />
    );
  }

  render() {
    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageSidebar={this._renderPageSidebar}
        renderPaneOne={this._renderTestSuite}
        renderPaneTwo={this._renderResults}
        renderPageHeader={this._renderPageHeader}
      />
    );
  }
}

export default WrapperUnitTest;
