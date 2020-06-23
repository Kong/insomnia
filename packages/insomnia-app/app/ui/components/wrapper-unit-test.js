// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import PageLayout from './page-layout';
import { Breadcrumb, Button, Header, RadioButtonGroup, SvgIcon } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import CodeEditor from './codemirror/code-editor';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
} from './activity-bar/activity-bar';
import designerLogo from '../images/insomnia-designer-logo.svg';
import type { WrapperProps } from './wrapper';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import type { ApiSpec } from '../../models/api-spec';
import { generateToFile, runTests } from 'insomnia-testing';
import { showModal, showPrompt } from './modals';
import Editable from './base/editable';
import type { SidebarChildObjects } from './sidebar/sidebar-children';
import SelectModal from './modals/select-modal';
import type { UnitTestSuite } from '../../models/unit-test-suite';

type Props = {|
  wrapperProps: WrapperProps,
  handleSetDebugActivity: (s: ApiSpec) => Promise<void>,
  children: SidebarChildObjects,
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
      await: true,
    },
    asi: true, // Don't require semicolons
    undef: true, // Prevent undefined usages
    node: true, // Enable NodeJS globals
    esversion: 8, // ES8 syntax (async/await, etc)
  };

  autocompleteConstants(): Array<{ name: string, value: () => Promise<string> }> {
    const requestPromptOptions = this.buildSelectableRequests().map(({ name, request }) => ({
      name: name,
      value:
        `const response = await insomnia.send('${request._id}');\n` +
        'expect(response.status).to.equal(200);',
    }));

    return [
      {
        name: 'Send Current Request',
        value:
          'const response = await insomnia.send();\n' + 'expect(response.status).to.equal(200);',
        displayValue: '',
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
                ...requestPromptOptions,
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
      defaultValue: 'My Test Suite',
      submitName: 'Create',
      label: 'Suite Name',
      selectText: true,
      onComplete: async name => {
        await models.unitTestSuite.create({
          parentId: activeWorkspace._id,
          name,
        });
      },
    });
  }

  async _handleCreateTest() {
    const { activeUnitTestSuite } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test',
      defaultValue: 'My Test',
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

  async _handleDebugSpec() {
    const {
      handleSetDebugActivity,
      wrapperProps: { activeApiSpec },
    } = this.props;
    await handleSetDebugActivity(activeApiSpec);
  }

  _handleBreadcrumb() {
    this.props.wrapperProps.handleSetActiveActivity(ACTIVITY_HOME);
  }

  async _handleRunTests() {
    const { activeUnitTests } = this.props.wrapperProps;
    await this._runTests(activeUnitTests);
  }

  async _handleRunTest(unitTest: UnitTest) {
    await this._runTests([unitTest]);
  }

  async _handleSetActiveRequest(unitTest: UnitTest, e: SyntheticEvent<HTMLSelectElement>) {
    const requestId = e.currentTarget.value === '__NULL__' ? null : e.currentTarget.value;
    await models.unitTest.update(unitTest, { requestId });
  }

  async _handleSetActiveUnitTestSuite(unitTestSuite: UnitTestSuite) {
    const { activeWorkspace } = this.props.wrapperProps;
    console.log('UPDATE', unitTestSuite);
    await models.workspaceMeta.updateByParentId(activeWorkspace._id, {
      activeUnitTestSuiteId: unitTestSuite._id,
    });
  }

  async _handleChangeTestName(unitTest: UnitTest, name: string) {
    await models.unitTest.update(unitTest, { name });
  }

  async _runTests(unitTests: Array<UnitTest>) {
    const { requests, activeWorkspace } = this.props.wrapperProps;

    this.setState({ testsRunning: unitTests });

    const p = '/Users/greg.schier/Desktop/test.js';
    const tests = [];
    for (const t of unitTests) {
      tests.push({
        name: t.name,
        code: t.code,
        defaultRequestId: t.requestId,
      });
    }

    await generateToFile(p, [
      {
        name: 'My Suite',
        suites: [],
        tests,
      },
    ]);
    const results = await runTests(p, {
      requests: [...requests],
    });

    await models.unitTestResult.create({
      results,
      parentId: activeWorkspace._id,
      code: '',
    });

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
              <option value="__NULL__">-- Select Request --</option>
              {this.buildSelectableRequests().map(({ name, request }) => (
                <option key={request._id} value={request._id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outlined"
            disabled={testsRunning && testsRunning.find(t => t._id === unitTest._id)}
            onClick={() => this._handleRunTest(unitTest)}>
            {testsRunning && testsRunning.find(t => t._id === unitTest._id) ? 'Running... ' : 'Run'}
          </Button>
        </div>
        <CodeEditor
          dynamicHeight
          manualPrettify
          fontSize={settings.editorFontSize}
          indentSize={settings.editorIndentSize}
          indentWithTabs={settings.editorIndentWithTabs}
          keyMap={settings.editorKeyMap}
          defaultValue={unitTest ? unitTest.code : ''}
          getAutocompleteSnippets={() => this.autocompleteConstants()}
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
              </li>
            ))}
          </ul>
        </div>
      </ErrorBoundary>
    );
  }

  render() {
    const { activeWorkspace, activity } = this.props.wrapperProps;
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
              <RadioButtonGroup
                defaultValue={activity}
                name="activity-toggle"
                onChange={this._handleDebugSpec}
                choices={[
                  { label: 'Design', value: ACTIVITY_SPEC },
                  { label: 'Debug', value: ACTIVITY_DEBUG },
                  { label: 'Test', value: ACTIVITY_UNIT_TEST },
                ]}
              />
            }
            gridRight={
              <Button
                variant="contained"
                bg="surprise"
                onClick={this._handleRunTests}
                size="default"
                disabled={testsRunning}>
                {testsRunning ? 'Running... ' : 'Run Tests'}
              </Button>
            }
          />
        )}
      />
    );
  }
}

export default WrapperUnitTest;
