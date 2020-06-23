// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import PageLayout from './page-layout';
import { Breadcrumb, Button, Header, Switch, SvgIcon } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import CodeEditor from './codemirror/code-editor';
import { ACTIVITY_HOME } from './activity-bar/activity-bar';
import designerLogo from '../images/insomnia-designer-logo.svg';
import type { WrapperProps } from './wrapper';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import type { ApiSpec } from '../../models/api-spec';
import { runTests, generateToFile } from 'insomnia-testing';
import { showPrompt } from './modals';

type Props = {|
  wrapperProps: WrapperProps,
  handleSetDebugActivity: (s: ApiSpec) => Promise<void>,
|};

type State = {||};

@autobind
class WrapperUnitTest extends React.PureComponent<Props, State> {
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

  static autocompleteConstants(): Array<{ name: string, value: string }> {
    return [
      {
        name: 'Send Request',
        value: `const resp = await insomnia.send();\nexpect(resp.status).to.equal(200);`,
      },
    ];
  }

  async _handleCreateTest() {
    const { activeWorkspace } = this.props.wrapperProps;
    showPrompt({
      title: 'New Test',
      defaultValue: 'My Test',
      submitName: 'Create',
      label: 'Test Name',
      selectText: true,
      onComplete: async name => {
        await models.unitTest.create({
          parentId: activeWorkspace._id,
          name,
        });
      },
    });
  }

  async _handleOnChange(unitTest: UnitTest, v: string) {
    const { activeWorkspace } = this.props.wrapperProps;
    await models.unitTest.update(unitTest, {
      parentId: activeWorkspace._id,
      code: v,
    });
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

  async _runTests(unitTests: Array<UnitTest>) {
    const { handleRender, requests, activeWorkspace } = this.props.wrapperProps;
    const p = '/Users/greg.schier/Desktop/test.js';
    const tests = [];
    for (const t of unitTests) {
      tests.push({
        name: t.name,
        code: await handleRender(t.code),
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
  }

  render() {
    const {
      activeUnitTests,
      activeUnitTestResults,
      settings,
      handleRender,
      handleGetRenderContext,
      requests,
    } = this.props.wrapperProps;

    activeUnitTestResults.sort((a, b) => (b.created > a.created ? 1 : -1));
    const result = activeUnitTestResults.length ? activeUnitTestResults[0] : null;
    console.log('RESULT', result);

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
            className="app-header"
            gridLeft={
              <React.Fragment>
                <img src={designerLogo} alt="Insomnia" width="32" height="32" />
                <Breadcrumb
                  className="breadcrumb"
                  crumbs={['Documents', 'Tests']}
                  onClick={this._handleBreadcrumb}
                />
              </React.Fragment>
            }
            gridCenter={
              <Switch
                onClick={this._handleDebugSpec}
                optionItems={[
                  { label: 'DESIGN', selected: true },
                  { label: 'DEBUG', selected: false },
                ]}
              />
            }
            gridRight={
              <React.Fragment>
                <Button variant="contained" onClick={this._handleRunTests}>
                  Run Tests
                </Button>
              </React.Fragment>
            }
          />
        )}
        renderPageBody={() => (
          <div className="unit-tests layout-body--sidebar theme--pane">
            <div className="unit-tests__tests theme--pane__body">
              {activeUnitTests.map(unitTest => (
                <div key={unitTest._id} className="unit-tests__tests__block">
                  <div className="unit-tests__tests__block__header">
                    <h2 className="pad-left-md">{unitTest.name}</h2>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => this._handleRunTest(unitTest)}>
                      Run Test
                    </Button>
                    <div className="form-control form-control--outlined">
                      <select
                        name="request"
                        id="request"
                        onChange={this._handleSetActiveRequest.bind(this, unitTest)}
                        value={unitTest.requestId || '__NULL__'}>
                        <option value="__NULL__">-- Select Request --</option>
                        {requests.map(r => (
                          <option key={r._id} value={r._id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <CodeEditor
                    dynamicHeight
                    manualPrettify
                    fontSize={settings.editorFontSize}
                    indentSize={settings.editorIndentSize}
                    indentWithTabs={settings.editorIndentWithTabs}
                    keyMap={settings.editorKeyMap}
                    render={handleRender}
                    defaultValue={unitTest ? unitTest.code : ''}
                    getAutocompleteConstants={WrapperUnitTest.autocompleteConstants}
                    lintOptions={WrapperUnitTest.lintOptions}
                    onChange={this._handleOnChange.bind(this, unitTest)}
                    getRenderContext={handleGetRenderContext}
                    nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
                    isVariableUncovered={settings.isVariableUncovered}
                    mode="javascript"
                    lineWrapping={settings.editorLineWrapping}
                    placeholder=""
                  />
                </div>
              ))}
            </div>
            <div className="unit-tests__results">
              {result && (
                <div key={result._id}>
                  {result.results.stats.failures ? (
                    <h2 className="warning">
                      Tests Failed {result.results.stats.failures}/{result.results.stats.tests}
                    </h2>
                  ) : (
                    <h2 className="success">
                      Tests Passed {result.results.stats.failures}/{result.results.stats.tests}
                    </h2>
                  )}
                  <ul>
                    {result.results.tests.map((t, i) => (
                      <li key={i}>
                        <SvgIcon icon={t.err.message ? 'error' : 'success'} /> {t.fullTitle} (
                        {t.duration} ms)
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
          </div>
        )}
        renderPageSidebar={() => (
          <ErrorBoundary showAlert>
            <div className="unit-tests__sidebar">
              <div className="pad-sm">
                <Button variant="outlined" bg="surprise" onClick={this._handleCreateTest}>
                  New Test
                </Button>
              </div>
              <ul>
                {activeUnitTests.map(t => (
                  <li key={t._id}>
                    <button key={t._id}>{t.name}</button>
                  </li>
                ))}
              </ul>
            </div>
          </ErrorBoundary>
        )}
      />
    );
  }
}

export default WrapperUnitTest;
