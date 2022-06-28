import classnames from 'classnames';
import {
  Button,
  Dropdown,
  DropdownItem,
  ListGroup,
  SvgIcon,
  UnitTestItem,
  UnitTestResultItem,
} from 'insomnia-components';
import { generate, runTests, Test } from 'insomnia-testing';
import { isEmpty } from 'ramda';
import React, { ReactNode, useState } from 'react';
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
import { selectActiveEnvironment, selectActiveUnitTestResult, selectActiveUnitTests, selectActiveUnitTestSuite, selectActiveUnitTestSuites, selectActiveWorkspace } from '../redux/selectors';
import { Editable } from './base/editable';
import { CodeEditor } from './codemirror/code-editor';
import { ErrorBoundary } from './error-boundary';
import { showAlert, showModal, showPrompt } from './modals';
import { SelectModal } from './modals/select-modal';
import { PageLayout } from './page-layout';
import { EmptyStatePane } from './panes/empty-state-pane';
import type { Child, SidebarChildObjects } from './sidebar/sidebar-children';
import { UnitTestEditable } from './unit-test-editable';
import { WorkspacePageHeader } from './workspace-page-header';
import type { HandleActivityChange, WrapperProps } from './wrapper';

const HeaderButton = styled(Button)({
  '&&': {
    marginRight: 'var(--padding-md)',
  },
});

interface Props {
  children: SidebarChildObjects;
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
  wrapperProps: WrapperProps;
}

const WrapperUnitTest: React.FC<Props> = ({
  children,
  wrapperProps,
  gitSyncDropdown,
  handleActivityChange,
}) => {
  const [testsRunning, settestsRunning] = useState<UnitTest[] | null>(null);
  const [resultsError, setresultsError] = useState<string | null>(null);
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
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeUnitTestSuite = useSelector(selectActiveUnitTestSuite);
  const activeUnitTestSuites = useSelector(selectActiveUnitTestSuites);
  const activeUnitTests = useSelector(selectActiveUnitTests);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeId = activeUnitTestSuite ? activeUnitTestSuite._id : 'n/a';

  const buildSelectableRequests = (): {
    name: string;
    request: Request;
  }[] => {
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

    next('', children.all);
    return selectableRequests;
  };
  const selectableRequests = buildSelectableRequests();

  const _handleCreateTestSuite = async () => {
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
        await _handleSetActiveUnitTestSuite(unitTestSuite);
        trackSegmentEvent(SegmentEvent.testSuiteCreate);
      },
    });
  };

  const generateSendReqSnippet = (existingCode: string, requestId: string) => {
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
  };

  const autocompleteSnippets = (unitTest: UnitTest) => {
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
  };

  const _handleCreateTest = () => {
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
  };

  const _handleUnitTestCodeChange = async (unitTest: UnitTest, v: string) => {
    await models.unitTest.update(unitTest, {
      code: v,
    });
  };

  const _handleRunTests = async () => {
    await _runTests(activeUnitTests);
    trackSegmentEvent(SegmentEvent.unitTestRunAll);
  };

  const _handleRunTest = async (unitTest: UnitTest) => {
    await _runTests([unitTest]);
    trackSegmentEvent(SegmentEvent.unitTestRun);
  };

  const _handleDeleteTest = (unitTest: UnitTest) => {
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
  };

  const _handleSetActiveRequest = async (
    unitTest: UnitTest,
    event: React.SyntheticEvent<HTMLSelectElement>,
  ) => {
    const requestId = event.currentTarget.value === '__NULL__' ? null : event.currentTarget.value;
    await models.unitTest.update(unitTest, {
      requestId,
    });
  };

  const _handleDeleteUnitTestSuite = (unitTestSuite: UnitTestSuite) => {
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
  };

  const _handleSetActiveUnitTestSuite = async (unitTestSuite: UnitTestSuite) => {
    if (!activeWorkspace) {
      return;
    }

    await models.workspaceMeta.updateByParentId(activeWorkspace._id, {
      activeUnitTestSuiteId: unitTestSuite._id,
    });
  };

  const _handleChangeTestName = async (unitTest: UnitTest, name?: string) => {
    await models.unitTest.update(unitTest, {
      name,
    });
  };

  const _handleChangeActiveSuiteName = async (name?: string) => {
    if (!activeUnitTestSuite) {
      return;
    }

    await models.unitTestSuite.update(activeUnitTestSuite, {
      name,
    });
  };

  const _runTests = async (unitTests: UnitTest[]) => {
    if (!activeWorkspace) {
      return;
    }
    settestsRunning(unitTests);
    setresultsError(null);
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
      settestsRunning(null);

    } catch (err) {
      // Set the state after a timeout so the user still sees the loading state
      setTimeout(() => {
        settestsRunning(null);
        setresultsError(err.message);
      }, 400);
      return;
    }
  };
  return (
    <PageLayout
      wrapperProps={wrapperProps}
      renderPageSidebar={
        <ErrorBoundary showAlert>
          <div className="unit-tests__sidebar">
            <div className="pad-sm">
              <Button variant="outlined" onClick={_handleCreateTestSuite}>
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
                  <button key={suite._id} onClick={() => _handleSetActiveUnitTestSuite(suite)}>
                    {suite.name}
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
                      onClick={_handleRunTests}
                      disabled={Boolean(testsRunning)}
                    >
                      {testsRunning ? 'Running... ' : 'Run Tests'}
                    </DropdownItem>
                    <DropdownItem onClick={_handleDeleteUnitTestSuite.bind(this, suite)}>
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
                onSubmit={_handleChangeActiveSuiteName}
                value={activeUnitTestSuite.name}
              />
            </h2>
            <HeaderButton
              variant="outlined"
              onClick={_handleCreateTest}
            >
              New Test
            </HeaderButton>
            <HeaderButton
              variant="contained"
              bg="surprise"
              onClick={_handleRunTests}
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
          <ListGroup>{activeUnitTests.map(unitTest =>
            <UnitTestItem
              item={unitTest}
              key={unitTest._id}
              onSetActiveRequest={event => _handleSetActiveRequest(unitTest, event)}
              onDeleteTest={() => _handleDeleteTest(unitTest)}
              onRunTest={() => _handleRunTest(unitTest)}
              testsRunning={testsRunning}
              selectedRequestId={unitTest.requestId}
              // @ts-expect-error -- TSCONVERSION
              selectableRequests={selectableRequests}
              testNameEditable={
                <UnitTestEditable
                  onSubmit={name => _handleChangeTestName(unitTest, name)}
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
                onChange={v => _handleUnitTestCodeChange(unitTest, v)}
                mode="javascript"
                placeholder=""
              />
            </UnitTestItem>)}</ListGroup>
        </div>
          : <div className="unit-tests pad theme--pane__body">No test suite selected</div>
      }
      renderPaneTwo={
        <TestRunStatus testsRunning={testsRunning} resultsError={resultsError} />
      }
      renderPageHeader={
        <WorkspacePageHeader
          handleActivityChange={handleActivityChange}
          gridRight={gitSyncDropdown}
        />
      }
    />
  );
};

export default WrapperUnitTest;

interface TestRunStatusProps{
  testsRunning:UnitTest[] | null;
  resultsError:string | null;
}
const TestRunStatus: React.FC<TestRunStatusProps> = ({ testsRunning, resultsError }) => {
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
