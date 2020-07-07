// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import PageLayout from './page-layout';
import { Breadcrumb, Button, Dropdown, DropdownItem, Header, SvgIcon } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import CodeEditor from './codemirror/code-editor';
import designerLogo from '../images/insomnia-designer-logo.svg';
import type { WrapperProps } from './wrapper';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import { generate, runTests } from 'insomnia-testing';
import { showAlert, showModal, showPrompt } from './modals';
import Editable from './base/editable';
import type { SidebarChildObjects } from './sidebar/sidebar-children';
import SelectModal from './modals/select-modal';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import ActivityToggle from './activity-toggle';
import { getSendRequestCallback } from '../../common/send-request';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_HOME } from '../../common/constants';

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

@autobind
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
  }

  async _handleRunTest(unitTest: UnitTest): Promise<void> {
    await this._runTests([unitTest]);
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

  renderResults(): React.Node {
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
            <ul>
              {tests.map((t, i) => (
                <li key={i}>
                  <SvgIcon icon={t.err.message ? 'error' : 'success'} /> {t.title} ({t.duration} ms)
                  {t.err.message && (
                    <>
                      <br />
                      <code className="text-danger">{t.err.message}</code>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  renderUnitTest(unitTest: UnitTest): React.Node {
    const { settings } = this.props.wrapperProps;
    const { testsRunning } = this.state;

    const selectableRequests = this.buildSelectableRequests();

    return (
      <div key={unitTest._id} className="unit-tests__tests__block">
        <div className="unit-tests__tests__block__header">
          <h2 className="pad-left-md">
            <Editable
              singleClick
              onSubmit={this._handleChangeTestName.bind(this, unitTest)}
              value={unitTest.name}
            />
          </h2>
          <div className="form-control form-control--outlined">
            <select
              name="request"
              id="request"
              onChange={this._handleSetActiveRequest.bind(this, unitTest)}
              value={unitTest.requestId || '__NULL__'}>
              <option value="__NULL__">
                {selectableRequests.length ? '-- Select Request --' : '-- No Requests --'}
              </option>
              {selectableRequests.map(({ name, request }) => (
                <option key={request._id} value={request._id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <Dropdown
            renderButton={() => (
              <Button variant="outlined">
                <SvgIcon icon="gear" />
              </Button>
            )}>
            <DropdownItem
              disabled={testsRunning && testsRunning.find(t => t._id === unitTest._id)}
              onClick={() => this._handleRunTest(unitTest)}>
              Run Test
            </DropdownItem>
            <DropdownItem onClick={() => this._handleDeleteTest(unitTest)}>Delete</DropdownItem>
          </Dropdown>
        </div>
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
      </div>
    );
  }

  renderPageBody(): React.Node {
    const { activeUnitTests, activeUnitTestSuite } = this.props.wrapperProps;
    const { testsRunning } = this.state;

    if (!activeUnitTestSuite) {
      return (
        <div className="unit-tests layout-body--sidebar theme--pane">
          <div className="unit-tests__tests theme--pane__body pad">No test suite selected</div>
        </div>
      );
    }

    return (
      <div className="unit-tests layout-body--sidebar theme--pane">
        <div className="unit-tests__tests theme--pane__body">
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
            </Button>
          </div>
          {activeUnitTests.map(this.renderUnitTest)}
        </div>
        {this.renderResults()}
      </div>
    );
  }

  renderPageSidebar(): React.Node {
    const { activeUnitTestSuites, activeUnitTestSuite } = this.props.wrapperProps;
    const { testsRunning } = this.state;
    const activeId = activeUnitTestSuite ? activeUnitTestSuite._id : 'n/a';

    return (
      <ErrorBoundary showAlert>
        <div className="unit-tests__sidebar">
          <div className="pad-sm">
            <Button variant="outlined" bg="surprise" onClick={this._handleCreateTestSuite}>
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

  render() {
    const { handleActivityChange, gitSyncDropdown } = this.props;
    const { activeWorkspace, activity, activeApiSpec } = this.props.wrapperProps;
    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageSidebar={this.renderPageSidebar}
        renderPageBody={this.renderPageBody}
        renderPageHeader={() => (
          <Header
            className="app-header"
            gridLeft={
              <React.Fragment>
                <img src={designerLogo} alt="Insomnia" width="32" height="32" />
                <Breadcrumb
                  className="breadcrumb"
                  crumbs={['Documents', activeApiSpec.fileName]}
                  onClick={this._handleBreadcrumb}
                />
              </React.Fragment>
            }
            gridCenter={
              <ActivityToggle
                activity={activity}
                handleActivityChange={handleActivityChange}
                workspace={activeWorkspace}
              />
            }
            gridRight={gitSyncDropdown}
          />
        )}
      />
    );
  }
}

export default WrapperUnitTest;
