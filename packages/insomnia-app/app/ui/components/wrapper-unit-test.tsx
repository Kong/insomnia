import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import {
  Button,
  Dropdown,
  DropdownItem,
  ListGroup,
  UnitTestItem,
  UnitTestResultItem,
} from 'insomnia-components';
import { generate, runTests, Test } from 'insomnia-testing';
import React, { PureComponent, ReactNode } from 'react';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import type { GlobalActivity } from '../../common/constants';
import { AUTOBIND_CFG } from '../../common/constants';
import { getSendRequestCallback } from '../../common/send-request';
import * as models from '../../models';
import { isRequest } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import type { UnitTest } from '../../models/unit-test';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import Editable from './base/editable';
import CodeEditor from './codemirror/code-editor';
import ErrorBoundary from './error-boundary';
import { showAlert, showModal, showPrompt } from './modals';
import { SelectModal } from './modals/select-modal';
import PageLayout from './page-layout';
import type { SidebarChildObjects } from './sidebar/sidebar-children';
import UnitTestEditable from './unit-test-editable';
import WorkspacePageHeader from './workspace-page-header';
import type { WrapperProps } from './wrapper';

interface Props {
  children: SidebarChildObjects;
  gitSyncDropdown: ReactNode;
  handleActivityChange: (options: {workspaceId?: string; nextActivity: GlobalActivity}) => Promise<void>;
  wrapperProps: WrapperProps;
}

interface State {
  testsRunning: UnitTest[] | null;
  resultsError: string | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperUnitTest extends PureComponent<Props, State> {
  state: State = {
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
    asi: true,
    // Don't require semicolons
    undef: true,
    // Prevent undefined usages
    node: true,
    // Enable NodeJS globals
    esversion: 8, // ES8 syntax (async/await, etc)
  };

  generateSendReqSnippet(existingCode: string, requestId: string) {
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

  autocompleteSnippets(unitTest: UnitTest) {
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
                {
                  name: '-- Select Request --',
                  value: '__NULL__',
                },
                ...this.buildSelectableRequests().map(({ name, request }) => ({
                  name: name,
                  displayValue: '',
                  // @ts-expect-error -- TSCONVERSION
                  value: this.generateSendReqSnippet(unitTest.code, `'${request._id}'`),
                })),
              ],
              onDone: value => resolve(value),
            });
          });
        },
      },
    ];
  }

  async _handleCreateTestSuite() {
    const { activeWorkspace } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return;
    }

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
        trackSegmentEvent(SegmentEvent.testSuiteCreate);
      },
    });
  }

  async _handleCreateTest() {
    const { activeUnitTestSuite } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test',
      defaultValue: 'Returns 200',
      submitName: 'New Test',
      label: 'Test Name',
      selectText: true,
      onComplete: async name => {
        await models.unitTest.create({
          parentId: activeUnitTestSuite?._id,
          code: this.generateSendReqSnippet('', ''),
          name,
        });
        trackSegmentEvent(SegmentEvent.unitTestCreate);
      },
    });
  }

  async _handleUnitTestCodeChange(unitTest: UnitTest, v: string) {
    await models.unitTest.update(unitTest, {
      code: v,
    });
  }

  async _handleRunTests() {
    const { activeUnitTests } = this.props.wrapperProps;
    await this._runTests(activeUnitTests);
    trackSegmentEvent(SegmentEvent.unitTestRunAll);
  }

  async _handleRunTest(unitTest: UnitTest) {
    await this._runTests([unitTest]);
    trackSegmentEvent(SegmentEvent.unitTestRun);
  }

  async _handleDeleteTest(unitTest: UnitTest) {
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
        trackSegmentEvent(SegmentEvent.unitTestDelete);
      },
    });
  }

  async _handleSetActiveRequest(
    unitTest: UnitTest,
    e: React.SyntheticEvent<HTMLSelectElement>,
  ) {
    const requestId = e.currentTarget.value === '__NULL__' ? null : e.currentTarget.value;
    await models.unitTest.update(unitTest, {
      requestId,
    });
  }

  async _handleDeleteUnitTestSuite(unitTestSuite: UnitTestSuite) {
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
        trackSegmentEvent(SegmentEvent.testSuiteDelete);
      },
    });
  }

  async _handleSetActiveUnitTestSuite(unitTestSuite: UnitTestSuite) {
    const { activeWorkspace } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return;
    }

    await models.workspaceMeta.updateByParentId(activeWorkspace._id, {
      activeUnitTestSuiteId: unitTestSuite._id,
    });
  }

  async _handleChangeTestName(unitTest: UnitTest, name: string) {
    await models.unitTest.update(unitTest, {
      name,
    });
  }

  async _handleChangeActiveSuiteName(name: string) {
    const { activeUnitTestSuite } = this.props.wrapperProps;
    // @ts-expect-error -- TSCONVERSION
    await models.unitTestSuite.update(activeUnitTestSuite, {
      name,
    });
  }

  async _runTests(unitTests: UnitTest[]) {
    const { activeWorkspace, activeEnvironment } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return;
    }

    this.setState({
      testsRunning: unitTests,
      resultsError: null,
    });
    const tests: Test[] = [];

    for (const t of unitTests) {
      tests.push({
        name: t.name,
        code: t.code,
        defaultRequestId: t.requestId,
      });
    }

    const src = await generate([
      {
        name: 'My Suite',
        suites: [],
        tests,
      },
    ]);
    const sendRequest = getSendRequestCallback(activeEnvironment?._id);

    try {
      const results = await runTests(src, { sendRequest });
      await models.unitTestResult.create({
        results,
        parentId: activeWorkspace._id,
      });
      this.setState({ testsRunning: null });
    } catch (err) {
      // Set the state after a timeout so the user still sees the loading state
      setTimeout(() => {
        this.setState({
          resultsError: err.message,
          testsRunning: null,
        });
      }, 400);
      return;
    }
  }

  buildSelectableRequests(): {
    name: string;
    request: Request;
  }[] {
    const { children } = this.props;
    const selectableRequests: {
      name: string;
      request: Request;
    }[] = [];

    const next = (p, children) => {
      for (const c of children) {
        if (isRequest(c.doc)) {
          selectableRequests.push({
            name: `${p} [${c.doc.method}] ${c.doc.name}`,
            request: c.doc,
          });
        } else if (isRequestGroup(c.doc)) {
          next(c.doc.name + ' / ', c.children);
        }
      }
    };

    next('', children.all);
    return selectableRequests;
  }

  _renderResults() {
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

  renderUnitTest(unitTest: UnitTest) {
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
        // @ts-expect-error -- TSCONVERSION
        selectableRequests={selectableRequests}
        testNameEditable={
          <UnitTestEditable
            onSubmit={this._handleChangeTestName.bind(this, unitTest)}
            value={unitTest.name}
          />
        }
      >
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

  _renderTestSuite() {
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
            disabled={Boolean(testsRunning)}
          >
            {testsRunning ? 'Running... ' : 'Run Tests'}
            <i className="fa fa-play space-left" />
          </Button>
        </div>
        <ListGroup>{activeUnitTests.map(this.renderUnitTest)}</ListGroup>
      </div>
    );
  }

  _renderPageSidebar() {
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
              <li
                key={s._id}
                className={classnames({
                  active: s._id === activeId,
                })}
              >
                <button key={s._id} onClick={this._handleSetActiveUnitTestSuite.bind(this, s)}>
                  {s.name}
                </button>
                <Dropdown
                  right
                  renderButton={() => (
                    <button className="unit-tests__sidebar__action">
                      <i className="fa fa-caret-down" />
                    </button>
                  )}
                >
                  <DropdownItem
                    stayOpenAfterClick
                    onClick={this._handleRunTests}
                    disabled={Boolean(testsRunning)}
                  >
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
