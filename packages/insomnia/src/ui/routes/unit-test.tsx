import classnames from 'classnames';
import { generate, runTests, Test } from 'insomnia-testing';
import { isEmpty } from 'ramda';
import React, { FC, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { documentationLinks } from '../../common/documentation';
import * as models from '../../models';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import type { UnitTest } from '../../models/unit-test';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { getSendRequestCallback } from '../../network/unit-test-feature';
import { Dropdown } from '../components/base/dropdown/dropdown';
import { DropdownButton } from '../components/base/dropdown/dropdown-button';
import { DropdownItem } from '../components/base/dropdown/dropdown-item';
import { Editable } from '../components/base/editable';
import { CodeEditor } from '../components/codemirror/code-editor';
import { ErrorBoundary } from '../components/error-boundary';
import { ListGroup, UnitTestItem, UnitTestResultItem } from '../components/list-group';
import { showAlert, showModal, showPrompt } from '../components/modals';
import { SelectModal } from '../components/modals/select-modal';
import { PageLayout } from '../components/page-layout';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import type { Child } from '../components/sidebar/sidebar-children';
import { SvgIcon } from '../components/svg-icon';
import { Button } from '../components/themed-button';
import { UnitTestEditable } from '../components/unit-test-editable';
import { WorkspacePageHeader } from '../components/workspace-page-header';
import { selectActiveEnvironment, selectActiveUnitTestResult, selectActiveUnitTests, selectActiveUnitTestSuite, selectActiveUnitTestSuites, selectActiveWorkspace } from '../redux/selectors';
import { selectSidebarChildren } from '../redux/sidebar-selectors';

const HeaderButton = styled(Button)({
  '&&': {
    marginRight: 'var(--padding-md)',
  },
});

const WrapperUnitTest: FC = () => {
  const [testsRunning, setTestsRunning] = useState<UnitTest[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const lintOptions = {
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
  const sidebarChildren = useSelector(selectSidebarChildren);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeUnitTestSuite = useSelector(selectActiveUnitTestSuite);
  const activeUnitTestSuites = useSelector(selectActiveUnitTestSuites);
  const activeUnitTests = useSelector(selectActiveUnitTests);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeId = activeUnitTestSuite ? activeUnitTestSuite._id : 'n/a';

  const buildSelectableRequests = useCallback(() => {
    const selectableRequests: {
      name: string;
      request: Request;
    }[] = [];

    const next = (p: string, children: Child[]) => {
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

    next('', sidebarChildren.all);
    return selectableRequests;
  }, [sidebarChildren.all]);

  const selectableRequests = buildSelectableRequests();

  const handleSetActiveUnitTestSuite = useCallback(async (unitTestSuite: UnitTestSuite) => {
    if (!activeWorkspace) {
      return;
    }

    await models.workspaceMeta.updateByParentId(activeWorkspace._id, {
      activeUnitTestSuiteId: unitTestSuite._id,
    });
  }, [activeWorkspace]);

  const handleCreateTestSuite = useCallback(async () => {
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
        await handleSetActiveUnitTestSuite(unitTestSuite);
        trackSegmentEvent(SegmentEvent.testSuiteCreate);
      },
    });
  }, [handleSetActiveUnitTestSuite, activeWorkspace]);

  const generateSendReqSnippet = useCallback((existingCode: string, requestId: string) => {
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
  }, []);

  const autocompleteSnippets = useCallback((unitTest: UnitTest) => {
    return [
      {
        name: 'Send Current Request',
        displayValue: '',
        value: generateSendReqSnippet(unitTest.code, ''),
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
                ...buildSelectableRequests().map(({ name, request }) => ({
                  name: name,
                  displayValue: '',
                  value: generateSendReqSnippet(unitTest.code, `'${request._id}'`),
                })),
              ],
              onDone: (value: string | null) => resolve(value),
            });
          });
        },
      },
    ];
  }, [buildSelectableRequests, generateSendReqSnippet]);

  const handleCreateTest = useCallback(() => {
    showPrompt({
      title: 'New Test',
      defaultValue: 'Returns 200',
      submitName: 'New Test',
      label: 'Test Name',
      selectText: true,
      onComplete: async name => {
        await models.unitTest.create({
          parentId: activeUnitTestSuite?._id,
          code: generateSendReqSnippet('', ''),
          name,
        });
        trackSegmentEvent(SegmentEvent.unitTestCreate);
      },
    });
  }, [activeUnitTestSuite?._id, generateSendReqSnippet]);

  const handleUnitTestCodeChange = useCallback((unitTest: UnitTest, code: string) => {
    models.unitTest.update(unitTest, { code });
  }, []);

  const handleDeleteTest = useCallback((unitTest: UnitTest) => {
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
  }, []);

  const handleSetActiveRequest = useCallback((
    unitTest: UnitTest,
    event: React.SyntheticEvent<HTMLSelectElement>,
  ) => {
    const requestId = event.currentTarget.value === '__NULL__' ? null : event.currentTarget.value;
    models.unitTest.update(unitTest, { requestId });
  }, []);

  const handleDeleteUnitTestSuite = useCallback((unitTestSuite: UnitTestSuite) => () => {
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
  }, []);

  const handleChangeTestName = useCallback((unitTest: UnitTest, name?: string) => {
    models.unitTest.update(unitTest, { name });
  }, []);

  const handleChangeActiveSuiteName = useCallback((name?: string) => {
    if (!activeUnitTestSuite) {
      return;
    }

    models.unitTestSuite.update(activeUnitTestSuite, { name });
  }, [activeUnitTestSuite]);

  const _runTests = useCallback(async (unitTests: UnitTest[]) => {
    if (!activeWorkspace) {
      return;
    }
    setTestsRunning(unitTests);
    setResultsError(null);
    const tests: Test[] = unitTests.map(t => ({ name: t.name, code: t.code, defaultRequestId: t.requestId }));
    const src = generate([{ name: 'My Suite', suites: [], tests }]);
    const sendRequest = getSendRequestCallback(activeEnvironment?._id);

    try {
      const results = await runTests(src, { sendRequest });
      await models.unitTestResult.create({
        results,
        parentId: activeWorkspace._id,
      });
      setTestsRunning(null);

    } catch (err) {
      // Set the state after a timeout so the user still sees the loading state
      setTimeout(() => {
        setTestsRunning(null);
        setResultsError(err.message);
      }, 400);
      return;
    }
  }, [activeEnvironment?._id, activeWorkspace]);

  const handleRunTests = useCallback(async () => {
    await _runTests(activeUnitTests);
    trackSegmentEvent(SegmentEvent.unitTestRunAll);
  }, [_runTests, activeUnitTests]);

  const handleRunTest = useCallback(async (unitTest: UnitTest) => {
    await _runTests([unitTest]);
    trackSegmentEvent(SegmentEvent.unitTestRun);
  }, [_runTests]);

  return (
    <PageLayout
      renderPageSidebar={
        <ErrorBoundary showAlert>
          <div className="unit-tests__sidebar">
            <div className="pad-sm">
              <Button variant="outlined" onClick={handleCreateTestSuite}>
                New Test Suite
              </Button>
            </div>
            <ul>
              {activeUnitTestSuites.map(suite => (
                <li
                  key={suite._id}
                  className={classnames({
                    active: suite._id === activeId,
                  })}
                >
                  <button key={suite._id} onClick={() => handleSetActiveUnitTestSuite(suite)}>
                    {suite.name}
                  </button>
                  <Dropdown
                    right
                  >
                    <DropdownButton className="unit-tests__sidebar__action">
                      <i className="fa fa-caret-down" />
                    </DropdownButton>
                    <DropdownItem
                      stayOpenAfterClick
                      onClick={handleRunTests}
                      disabled={Boolean(testsRunning)}
                    >
                      {testsRunning ? 'Running... ' : 'Run Tests'}
                    </DropdownItem>
                    <DropdownItem onClick={handleDeleteUnitTestSuite(suite)}>
                      Delete Suite
                    </DropdownItem>
                  </Dropdown>
                </li>
              ))}
            </ul>
          </div>
        </ErrorBoundary>
      }
      renderPaneOne={
        activeUnitTestSuite ? <div className="unit-tests theme--pane__body">
          <div className="unit-tests__top-header">
            <h2>
              <Editable
                singleClick
                onSubmit={handleChangeActiveSuiteName}
                value={activeUnitTestSuite.name}
              />
            </h2>
            <HeaderButton
              variant="outlined"
              onClick={handleCreateTest}
            >
              New Test
            </HeaderButton>
            <HeaderButton
              variant="contained"
              bg="surprise"
              onClick={handleRunTests}
              size="default"
              disabled={Boolean(testsRunning)}
            >
              {testsRunning ? 'Running... ' : 'Run Tests'}
              <i className="fa fa-play space-left" />
            </HeaderButton>
          </div>
          {isEmpty(activeUnitTests) ?
            <div style={{ height: '100%' }}>
              <EmptyStatePane
                icon={<SvgIcon icon="vial" />}
                documentationLinks={[
                  documentationLinks.unitTesting,
                  documentationLinks.introductionToInsoCLI,
                ]}
                title="Add unit tests to verify your API"
                secondaryAction="You can run these tests in CI with Inso CLI"
              />
            </div> : null}
          <ListGroup>
            {activeUnitTests.map(unitTest =>
              <UnitTestItem
                item={unitTest}
                key={unitTest._id}
                onSetActiveRequest={event => handleSetActiveRequest(unitTest, event)}
                onDeleteTest={() => handleDeleteTest(unitTest)}
                onRunTest={() => handleRunTest(unitTest)}
                testsRunning={testsRunning}
                selectedRequestId={unitTest.requestId}
                // @ts-expect-error -- TSCONVERSION
                selectableRequests={selectableRequests}
                testNameEditable={
                  <UnitTestEditable
                    onSubmit={name => handleChangeTestName(unitTest, name)}
                    value={unitTest.name}
                  />
                }
              >
                <CodeEditor
                  dynamicHeight
                  manualPrettify
                  defaultValue={unitTest ? unitTest.code : ''}
                  getAutocompleteSnippets={() => autocompleteSnippets(unitTest)}
                  lintOptions={lintOptions}
                  onChange={code => handleUnitTestCodeChange(unitTest, code)}
                  mode="javascript"
                  placeholder=""
                />
              </UnitTestItem>)}
          </ListGroup>
        </div>
          : <div className="unit-tests pad theme--pane__body">No test suite selected</div>
      }
      renderPaneTwo={
        <TestRunStatus testsRunning={testsRunning} resultsError={resultsError} />
      }
      renderPageHeader={
        <WorkspacePageHeader />
      }
    />
  );
};

export default WrapperUnitTest;

interface TestRunStatusProps {
  testsRunning: UnitTest[] | null;
  resultsError: string | null;
}
const TestRunStatus: FC<TestRunStatusProps> = ({ testsRunning, resultsError }) => {
  const activeUnitTestResult = useSelector(selectActiveUnitTestResult);

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
              {tests.map((t: any, i: number) => (
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
};
