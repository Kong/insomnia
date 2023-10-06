import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { FC, Fragment, Suspense, useState } from 'react';
import {
  Breadcrumbs,
  Button,
  GridList,
  Heading,
  Item,
  Link,
  ListBox,
  Menu,
  MenuTrigger,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';
import {
  LoaderFunction,
  NavLink,
  Route,
  Routes,
  useFetcher,
  useFetchers,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';

import * as models from '../../models';
import { Environment } from '../../models/environment';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { invariant } from '../../utils/invariant';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '../components/editable-input';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { CookiesModal } from '../components/modals/cookies-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { SidebarLayout } from '../components/sidebar-layout';
import { TestRunStatus } from './test-results';
import TestSuiteRoute from './test-suite';
import { WorkspaceLoaderData } from './workspace';

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

  const { organizationId, projectId, workspaceId, testSuiteId } =
    useParams() as {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
    };

  const {
    activeProject,
    activeEnvironment,
    activeCookieJar,
    subEnvironments,
    baseEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const setActiveEnvironmentFetcher = useFetcher();
  const environmentsList = [baseEnvironment, ...subEnvironments].map(e => ({
    id: e._id,
    name: e.name,
    color: e.color,
  }));

  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);

  const createUnitTestSuiteFetcher = useFetcher();
  const deleteUnitTestSuiteFetcher = useFetcher();
  const renameTestSuiteFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const runningTests = useFetchers()
    .filter(
      fetcher =>
        fetcher.formAction?.includes('run-all-tests') ||
        fetcher.formAction?.includes('run')
    )
    .some(({ state }) => state !== 'idle');

  const navigate = useNavigate();

  const testSuiteActionList: {
    id: string;
    name: string;
    icon: IconName;
    action: (suiteId: string) => void;
  }[] = [
    {
      id: 'run-tests',
      name: 'Run tests',
      icon: 'play',
      action: suiteId => {
        runAllTestsFetcher.submit(
          {},
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suiteId}/run-all-tests`,
          }
        );
      },
    },
    {
      id: 'delete-suite',
      name: 'Delete suite',
      icon: 'trash',
      action: suiteId => {
        deleteUnitTestSuiteFetcher.submit(
          {},
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suiteId}/delete`,
            method: 'POST',
          }
        );
      },
    },
  ];

  return (
    <SidebarLayout
      className='new-sidebar'
      renderPageSidebar={
        <ErrorBoundary showAlert>
          <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
          <div className="flex flex-col items-start gap-2 justify-between p-[--padding-sm]">
            <Breadcrumbs className='react-aria-Breadcrumbs pb-[--padding-sm] border-b border-solid border-[--hl-sm] font-bold w-full'>
              <Item className="react-aria-Item h-full outline-none data-[focused]:outline-none">
                <Link data-testid="project" className="px-1 py-1 aspect-square h-7 flex flex-shrink-0 outline-none data-[focused]:outline-none items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <NavLink
                    to={`/organization/${organizationId}/project/${activeProject._id}`}
                  >
                    <Icon className='text-xs' icon="chevron-left" />
                  </NavLink>
                </Link>
                <span aria-hidden role="separator" className='text-[--hl-lg] h-4 outline outline-1' />
              </Item>
              <Item className="react-aria-Item h-full outline-none data-[focused]:outline-none">
                <WorkspaceDropdown />
              </Item>
            </Breadcrumbs>
            <div className="flex w-full items-center gap-2 justify-between">
              <Select
                aria-label="Select an environment"
                onSelectionChange={environmentId => {
                  setActiveEnvironmentFetcher.submit(
                    {
                      environmentId,
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                    }
                  );
                }}
                selectedKey={activeEnvironment._id}
                items={environmentsList}
              >
                <Button className="px-4 py-1 flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <SelectValue<Environment> className="flex truncate items-center justify-center gap-2">
                    {({ isPlaceholder, selectedItem }) => {
                      if (
                        isPlaceholder ||
                        (selectedItem &&
                          selectedItem._id === baseEnvironment._id) ||
                        !selectedItem
                      ) {
                        return (
                          <Fragment>
                            <Icon icon="cancel" />
                            No Environment
                          </Fragment>
                        );
                      }

                      return (
                        <Fragment>
                          <Icon
                            icon="circle"
                            style={{
                              color: selectedItem.color ?? 'var(--color-font)',
                            }}
                          />
                          {selectedItem.name}
                        </Fragment>
                      );
                    }}
                  </SelectValue>
                  <Icon icon="caret-down" />
                </Button>
                <Popover className="min-w-max">
                  <ListBox<Environment>
                    key={activeEnvironment._id}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    {item => (
                      <Item
                        id={item._id}
                        key={item._id}
                        className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                        aria-label={item.name}
                        textValue={item.name}
                        value={item}
                      >
                        {({ isSelected }) => (
                          <Fragment>
                            <Icon
                              icon={
                                item._id === baseEnvironment._id
                                  ? 'cancel'
                                  : 'circle'
                              }
                              style={{
                                color: item.color ?? 'var(--color-font)',
                              }}
                            />
                            <span>
                              {item._id === baseEnvironment._id
                                ? 'No Environment'
                                : item.name}
                            </span>
                            {isSelected && (
                              <Icon
                                icon="check"
                                className="text-[--color-success] justify-self-end"
                              />
                            )}
                          </Fragment>
                        )}
                      </Item>
                    )}
                  </ListBox>
                </Popover>
              </Select>
              <Button
                aria-label='Manage Environments'
                onPress={() => setEnvironmentModalOpen(true)}
                className="flex flex-shrink-0 items-center justify-center aspect-square h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              >
                <Icon icon="gear" />
              </Button>
            </div>
            <Button
              onPress={() => setIsCookieModalOpen(true)}
              className="px-4 py-1 flex-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            >
              <Icon icon="cookie-bite" />
              {activeCookieJar.cookies.length === 0 ? 'Add' : 'Manage'} Cookies
            </Button>
          </div>
            <div className="p-[--padding-sm]">
              <Button
                className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                onPress={() => {
                  createUnitTestSuiteFetcher.submit(
                    {
                      name: 'New Suite',
                    },
                    {
                      method: 'post',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/new`,
                    }
                  );
                }}
              >
                <Icon icon="plus" />
                New test suite
              </Button>
            </div>
            <GridList
              aria-label="Projects"
              items={unitTestSuites.map(suite => ({
                id: suite._id,
                key: suite._id,
                ...suite,
              }))}
              className="overflow-y-auto flex-1 data-[empty]:py-0 py-[--padding-sm]"
              disallowEmptySelection
              selectedKeys={[testSuiteId]}
              selectionMode="single"
              onSelectionChange={keys => {
                if (keys !== 'all') {
                  const value = keys.values().next().value;
                  navigate({
                    pathname: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${value}`,
                  });
                }
              }}
            >
              {item => {
                return (
                  <Item
                    key={item._id}
                    id={item._id}
                    textValue={item.name}
                    className="group outline-none select-none w-full"
                  >
                    <div className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]">
                      <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                      <EditableInput
                        value={item.name}
                        name="name"
                        ariaLabel="Test suite name"
                        onChange={name => {
                          renameTestSuiteFetcher.submit(
                            { name },
                            {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${item._id}/rename`,
                              method: 'POST',
                            }
                          );
                        }}
                      />
                      <span className="flex-1" />
                      <MenuTrigger>
                        <Button
                          aria-label="Project Actions"
                          className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                        >
                          <Icon icon="caret-down" />
                        </Button>
                        <Popover className="min-w-max">
                          <Menu
                            aria-label="Project Actions Menu"
                            selectionMode="single"
                            onAction={key => {
                              testSuiteActionList
                                .find(({ id }) => key === id)
                                ?.action(item._id);
                            }}
                            items={testSuiteActionList}
                            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                          >
                            {item => (
                              <Item
                                key={item.id}
                                id={item.id}
                                className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                                aria-label={item.name}
                              >
                                <Icon icon={item.icon} />
                                <span>{item.name}</span>
                              </Item>
                            )}
                          </Menu>
                        </Popover>
                      </MenuTrigger>
                    </div>
                  </Item>
                );
              }}
            </GridList>
          </div>
          <WorkspaceSyncDropdown />
          {isEnvironmentModalOpen && (
            <WorkspaceEnvironmentsEditModal
              onHide={() => setEnvironmentModalOpen(false)}
            />
          )}
          {isCookieModalOpen && (
            <CookiesModal onHide={() => setIsCookieModalOpen(false)} />
          )}
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
              <div className="p-[--padding-md]">No test suite selected</div>
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
                <Heading className="text-lg flex-shrink-0 flex items-center gap-2 w-full p-[--padding-md] border-solid border-b border-b-[--hl-md]">
                  <Icon icon="spinner" className="fa-pulse" /> Running tests...
                </Heading>
              ) : (
                <TestRunStatus />
              )
            }
          />
          <Route
            path="*"
            element={
              <Heading className="text-lg flex-shrink-0 flex items-center gap-2 w-full p-[--padding-md] border-solid border-b border-b-[--hl-md]">
                {runningTests ? (
                  <>
                    <Icon icon="spinner" className="fa-pulse" /> Running
                    tests...
                  </>
                ) : (
                  'No test results'
                )}
              </Heading>
            }
          />
        </Routes>
      }
    />
  );
};

export default TestRoute;
