import classnames from 'classnames';
import React, { FC, Suspense } from 'react';
import {
  LoaderFunction,
  Route,
  Routes,
  useFetcher,
  useFetchers,
  useLoaderData,
  useNavigate,
  useParams,
} from 'react-router-dom';

import * as models from '../../models';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { showPrompt } from '../components/modals';
import { SidebarLayout } from '../components/sidebar-layout';
import { Button } from '../components/themed-button';
import { TestRunStatus } from './test-results';
import TestSuiteRoute from './test-suite';

interface LoaderData {
  unitTestSuites: UnitTestSuite[];
}

export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId } = params;

  invariant(workspaceId, 'Workspace ID is required');

  const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);
  invariant(unitTestSuites, 'Unit test suites not found');

  return {
    unitTestSuites,
  };
};

const TestRoute: FC = () => {
  const { unitTestSuites } = useLoaderData() as LoaderData;

  const { organizationId, projectId, workspaceId, testSuiteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    testSuiteId: string;
  };

  const createUnitTestSuiteFetcher = useFetcher();
  const deleteUnitTestSuiteFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const runningTests = useFetchers()
    .filter(
      fetcher =>
        fetcher.formAction?.includes('run-all-tests') ||
        fetcher.formAction?.includes('run')
    )
    .some(({ state }) => state !== 'idle');

  const navigate = useNavigate();

  return (
    <SidebarLayout
      renderPageSidebar={
        <ErrorBoundary showAlert>
          <div className="unit-tests__sidebar">
            <div className="pad-sm">
              <Button
                variant="outlined"
                onClick={() => {
                  showPrompt({
                    title: 'New Test Suite',
                    defaultValue: 'New Suite',
                    submitName: 'Create Suite',
                    label: 'Test Suite Name',
                    selectText: true,
                    onComplete: async name => {
                      createUnitTestSuiteFetcher.submit(
                        {
                          name,
                        },
                        {
                          method: 'post',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/new`,
                        }
                      );
                    },
                  });
                }}
              >
                New Test Suite
              </Button>
            </div>
            <ul>
              {unitTestSuites.map(suite => (
                <li
                  key={suite._id}
                  className={classnames({
                    active: suite._id === testSuiteId,
                  })}
                >
                  <button
                    onClick={e => {
                      e.preventDefault();
                      navigate(
                        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suite._id}`
                      );
                    }}
                  >
                    {suite.name}
                  </button>

                  <Dropdown
                    aria-label='Test Suite Actions'
                    triggerButton={
                      <DropdownButton className="unit-tests__sidebar__action">
                        <i className="fa fa-caret-down" />
                      </DropdownButton>
                    }
                  >
                    <DropdownItem aria-label='Run Tests'>
                      <ItemContent
                        stayOpenAfterClick
                        isDisabled={runAllTestsFetcher.state === 'submitting'}
                        label={runAllTestsFetcher.state === 'submitting'
                          ? 'Running... '
                          : 'Run Tests'}
                        onClick={() => {
                          runAllTestsFetcher.submit(
                            {},
                            {
                              method: 'post',
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suite._id}/run-all-tests`,
                            }
                          );
                        }}
                      />
                    </DropdownItem>
                    <DropdownItem aria-label='Delete Suite'>
                      <ItemContent
                        label="Delete Suite"
                        withPrompt
                        onClick={() =>
                          deleteUnitTestSuiteFetcher.submit(
                            {},
                            {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suite._id}/delete`,
                              method: 'post',
                            }
                          )
                        }
                      />
                    </DropdownItem>
                  </Dropdown>
                </li>
              ))}
            </ul>
          </div>
        </ErrorBoundary>
      }
      renderPaneOne={
        <Routes>
          <Route
            path={'test-suite/:testSuiteId/*'}
            element={
              <Suspense>
                <TestSuiteRoute />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <div className="unit-tests pad theme--pane__body">
                No test suite selected
              </div>
            }
          />
        </Routes>
      }
      renderPaneTwo={
        <Routes>
          <Route
            path="test-suite/:testSuiteId/test-result/:testResultId"
            element={
              runningTests ? (
                <div className="unit-tests__results">
                  <div className="unit-tests__top-header">
                    <h2>Running Tests...</h2>
                  </div>
                </div>
              ) : (
                <TestRunStatus />
              )
            }
          />
          <Route
            path="*"
            element={
              runningTests ? (
                <div className="unit-tests__results">
                  <div className="unit-tests__top-header">
                    <h2>Running Tests...</h2>
                  </div>
                </div>
              ) : (
                <div className="unit-tests__results">
                  <div className="unit-tests__top-header">
                    <h2>No Results</h2>
                  </div>
                </div>
              )
            }
          />
        </Routes>
      }
    />
  );
};

export default TestRoute;
