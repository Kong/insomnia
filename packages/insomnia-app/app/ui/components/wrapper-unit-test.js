// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import PageLayout from './page-layout';
import { Breadcrumb, Button, Dropdown, DropdownItem, Header, SvgIcon } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import CodeEditor from './codemirror/code-editor';
import type { GlobalActivity } from './activity-bar/activity-bar';
import { ACTIVITY_HOME } from './activity-bar/activity-bar';
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

type Props = {|
  children: SidebarChildObjects,
  gitSyncDropdown: React.Node,
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>,
  wrapperProps: WrapperProps,
|};

type State = {|
  testsRunning: Array<UnitTest> | null,
|};

@autobind
class WrapperUnitTest extends React.PureComponent<Props, State> {
  state = {
    testsRunning: null,
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

  autocompleteConstants(unitTest: UnitTest): Array<{ name: string, value: () => Promise<string> }> {
    const sendReqSnippet = (requestId: string) => {
      for (let i = 1; i < 100; i++) {
        const variableName = `response${i}`;
        if (!unitTest.code.includes(`const ${variableName} =`)) {
          return (
            `const ${variableName} = await insomnia.send(${requestId});\n` +
            `expect(${variableName}.status).to.equal(200);`
          );
        }
      }
    };

    return [
      {
        name: 'Send Current Request',
        displayValue: '',
        value: sendReqSnippet(''),
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
                  value: sendReqSnippet(`'${request._id}'`),
                })),
              ],
              onDone: v => resolve(v),
            });
          });
        },
      },
    ];
  }

  async _handleCreateTestSuite() {
    const { activeWorkspace } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test Suite',
      defaultValue: activeWorkspace.name + ' Suite',
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

  async _handleCreateTest() {
    const { activeUnitTestSuite } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test',
      defaultValue: 'Returns 200',
      submitName: 'Create Test',
      label: 'Test Name',
      selectText: true,
      onComplete: async name => {
        await models.unitTest.create({
          parentId: activeUnitTestSuite._id,
          code:
            'const response = await insomnia.send();\n' +
            'expect(response.status).to.equal(200);\n\n// TODO: Add test code here',
          name,
        });
      },
    });
  }

  async _handleUnitTestCodeChange(unitTest: UnitTest, v: string) {
    await models.unitTest.update(unitTest, { code: v });
  }

  _handleBreadcrumb() {
    const {
      handleActivityChange,
      wrapperProps: { activeWorkspace },
    } = this.props;
    handleActivityChange(activeWorkspace._id, ACTIVITY_HOME);
  }

  async _handleRunTests() {
    const { activeUnitTests } = this.props.wrapperProps;
    await this._runTests(activeUnitTests);
  }

  async _handleRunTest(unitTest: UnitTest) {
    await this._runTests([unitTest]);
  }

  async _handleDeleteTest(unitTest: UnitTest) {
    await models.unitTest.remove(unitTest);
  }

  async _handleSetActiveRequest(unitTest: UnitTest, e: SyntheticEvent<HTMLSelectElement>) {
    const requestId = e.currentTarget.value === '__NULL__' ? null : e.currentTarget.value;
    await models.unitTest.update(unitTest, { requestId });
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
      },
    });
  }

  async _handleSetActiveUnitTestSuite(unitTestSuite: UnitTestSuite) {
    const { activeWorkspace } = this.props.wrapperProps;
    await models.workspaceMeta.updateByParentId(activeWorkspace._id, {
      activeUnitTestSuiteId: unitTestSuite._id,
    });
  }

  async _handleChangeTestName(unitTest: UnitTest, name: string) {
    await models.unitTest.update(unitTest, { name });
  }

  async _runTests(unitTests: Array<UnitTest>) {
    const { requests, activeWorkspace, activeEnvironment } = this.props.wrapperProps;

    this.setState({ testsRunning: unitTests });

    const tests = [];
    for (const t of unitTests) {
      tests.push({
        name: t.name,
        code: t.code,
        defaultRequestId: t.requestId,
      });
    }

    const src = await generate([{ name: 'My Suite', suites: [], tests }]);
    const results = await runTests(src, {
      requests,
      sendRequest: getSendRequestCallback(activeEnvironment ? activeEnvironment._id : null),
    });

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

  renderResults() {
    const { activeUnitTestResult } = this.props.wrapperProps;
    const { testsRunning } = this.state;

    if (testsRunning) {
      return (
        <div className="unit-tests__results">
          <h2>Running {testsRunning.length} Tests...</h2>
        </div>
      );
    }

    if (!activeUnitTestResult) {
      return null;
    }

    const { stats, tests } = activeUnitTestResult.results;

    return (
      <div className="unit-tests__results">
        {activeUnitTestResult && (
          <div key={activeUnitTestResult._id}>
            {stats.failures ? (
              <h2 className="warning">
                Tests Failed {stats.failures}/{stats.tests}
              </h2>
            ) : (
              <h2 className="success">
                Tests Passed {stats.passes}/{stats.tests}
              </h2>
            )}
            <ul>
              {tests.map((t, i) => (
                <li key={i}>
                  <SvgIcon icon={t.err.message ? 'error' : 'success'} /> {t.fullTitle} ({t.duration}{' '}
                  ms)
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

  renderUnitTest(unitTest: UnitTest) {
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
          getAutocompleteSnippets={() => [
            { name: 'Snippet', displayValue: '', value: async () => 'Can do anything here' },
          ]}
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

  renderPageBody() {
    const { activeUnitTests, activeUnitTestSuite } = this.props.wrapperProps;

    if (!activeUnitTestSuite) {
      return (
        <div className="unit-tests layout-body--sidebar theme--pane">
          <div className="unit-tests__tests theme--pane__body">No test suite selected</div>
        </div>
      );
    }

    return (
      <div className="unit-tests layout-body--sidebar theme--pane">
        <div className="unit-tests__tests theme--pane__body">
          {activeUnitTests.map(this.renderUnitTest)}
          <div className="pad">
            <Button variant="contained" bg="surprise" onClick={this._handleCreateTest}>
              Create Test
            </Button>
          </div>
        </div>
        {this.renderResults()}
      </div>
    );
  }

  renderPageSidebar() {
    const { activeUnitTestSuites, activeUnitTestSuite } = this.props.wrapperProps;
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
    const { activeWorkspace, activity, settings } = this.props.wrapperProps;
    const { testsRunning } = this.state;
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
                  crumbs={['Documents', activeWorkspace.name]}
                  onClick={this._handleBreadcrumb}
                />
              </React.Fragment>
            }
            gridCenter={
              <ActivityToggle
                activity={activity}
                handleActivityChange={handleActivityChange}
                settings={settings}
                workspace={activeWorkspace}
              />
            }
            gridRight={
              <>
                <Button
                  variant="contained"
                  onClick={this._handleRunTests}
                  size="default"
                  disabled={testsRunning}>
                  {testsRunning ? 'Running... ' : 'Run Tests'}
                </Button>
                {gitSyncDropdown}
              </>
            }
          />
        )}
      />
    );
  }
}

export default WrapperUnitTest;
