import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  useDragAndDrop,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  type LoaderFunction,
  NavLink,
  Route,
  Routes,
  useFetcher,
  useFetchers,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router';

import { DEFAULT_SIDEBAR_SIZE } from '../../common/constants';
import { database } from '../../common/database';
import { isNotNullOrUndefined } from '../../common/misc';
import * as models from '../../models';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { invariant } from '../../utils/invariant';
import { DocumentTab } from '../components/document-tab';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '../components/editable-input';
import { EnvironmentPicker } from '../components/environment-picker';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { CookiesModal } from '../components/modals/cookies-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { CertificatesModal } from '../components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '../components/tabs/tab-list';
import { INSOMNIA_TAB_HEIGHT } from '../constant';
import { useInsomniaTab } from '../hooks/use-insomnia-tab';
import type { WorkspaceLoaderData } from './$organizationId.project.$projectId.workspace.$workspaceId';
import TestSuiteRoute from './$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId';
import { TestRunStatus } from './$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test-result.$testResultId';
import { useRootLoaderData } from './root';

interface LoaderData {
  unitTestSuites: UnitTestSuite[];
}

export const loader: LoaderFunction = async ({ params }): Promise<LoaderData> => {
  const { workspaceId } = params;

  invariant(workspaceId, 'Workspace ID is required');

  const unitTestSuites = await database.find<UnitTestSuite>(
    models.unitTestSuite.type,
    {
      parentId: workspaceId,
    },
    {
      metaSortKey: 1,
    },
  );

  invariant(unitTestSuites, 'Unit test suites not found');

  return {
    unitTestSuites,
  };
};

const TestRoute: FC = () => {
  const { unitTestSuites } = useLoaderData() as LoaderData;
  const { settings } = useRootLoaderData();
  const { organizationId, projectId, workspaceId, testSuiteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    testSuiteId: string;
  };

  const { activeProject, activeWorkspace, activeCookieJar, caCertificate, clientCertificates } = useRouteLoaderData(
    ':workspaceId',
  ) as WorkspaceLoaderData;

  const { unitTestSuite } = (useRouteLoaderData(':testSuiteId') as { unitTestSuite: UnitTestSuite }) || {};

  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  const createUnitTestSuiteFetcher = useFetcher();
  const deleteUnitTestSuiteFetcher = useFetcher();
  const updateTestSuiteFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const runningTests = useFetchers()
    .filter(fetcher => fetcher.formAction?.includes('run-all-tests') || fetcher.formAction?.includes('run'))
    .some(({ state }) => state !== 'idle');

  const navigate = useNavigate();
  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);

  function toggleSidebar() {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    if (layout && layout[0] > 0) {
      layout[0] = 0;
    } else {
      layout[0] = DEFAULT_SIDEBAR_SIZE;
    }

    sidebarPanelRef.current?.setLayout(layout);
  }

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', toggleSidebar);

    return unsubscribe;
  }, []);

  useDocBodyKeyboardShortcuts({
    sidebar_toggle: toggleSidebar,
    environment_showEditor: () => setEnvironmentModalOpen(true),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
    showCookiesEditor: () => setIsCookieModalOpen(true),
  });

  const testSuiteActionList: {
    id: string;
    name: string;
    icon: IconName;
    action: (suiteId: string, suiteName: string) => void;
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
          },
        );
      },
    },
    {
      id: 'rename',
      name: 'Rename',
      icon: 'edit',
      action: suiteId => {
        showModal(PromptModal, {
          title: 'Rename test suite',
          defaultValue: unitTestSuites.find(s => s._id === suiteId)?.name,
          submitName: 'Rename',
          onComplete: name => {
            name &&
              updateTestSuiteFetcher.submit(
                { name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suiteId}/update`,
                  method: 'POST',
                  encType: 'application/json',
                },
              );
          },
        });
      },
    },
    {
      id: 'delete-suite',
      name: 'Delete suite',
      icon: 'trash',
      action: (suiteId, suiteName) => {
        showModal(AskModal, {
          title: 'Delete suite',
          message: `Do you really want to delete "${suiteName}"?`,
          yesText: 'Delete',
          noText: 'Cancel',
          color: 'danger',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              deleteUnitTestSuiteFetcher.submit(
                {},
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suiteId}/delete`,
                  method: 'POST',
                },
              );
            }
          },
        });
      },
    },
  ];

  const testSuitesDragAndDrop = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(e) {
      const source = [...e.keys][0];
      const sourceTestSuite = unitTestSuites.find(testSuite => testSuite._id === source);
      const targetTestSuite = unitTestSuites.find(testSuite => testSuite._id === e.target.key);
      if (!sourceTestSuite || !targetTestSuite) {
        return;
      }
      const dropPosition = e.target.dropPosition;
      if (dropPosition === 'before') {
        const currentTestSuiteIndex = unitTestSuites.findIndex(testSuite => testSuite._id === targetTestSuite._id);
        const previousTestSuite = unitTestSuites[currentTestSuiteIndex - 1];
        if (!previousTestSuite) {
          sourceTestSuite.metaSortKey = targetTestSuite.metaSortKey - 1;
        } else {
          sourceTestSuite.metaSortKey = (previousTestSuite.metaSortKey + targetTestSuite.metaSortKey) / 2;
        }
      }
      if (dropPosition === 'after') {
        const currentTestSuiteIndex = unitTestSuites.findIndex(testSuite => testSuite._id === targetTestSuite._id);
        const nextEnv = unitTestSuites[currentTestSuiteIndex + 1];
        if (!nextEnv) {
          sourceTestSuite.metaSortKey = targetTestSuite.metaSortKey + 1;
        } else {
          sourceTestSuite.metaSortKey = (nextEnv.metaSortKey + targetTestSuite.metaSortKey) / 2;
        }
      }

      updateTestSuiteFetcher.submit(
        { metaSortKey: sourceTestSuite.metaSortKey },
        {
          method: 'post',
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${sourceTestSuite._id}/update`,
          encType: 'application/json',
        },
      );
    },
    renderDropIndicator(target) {
      return <DropIndicator target={target} className="outline outline-1 outline-[--color-surprise]" />;
    },
  });

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    settings.forceVerticalLayout ? 'vertical' : 'horizontal',
  );
  useLayoutEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => {};
    }
    // Listen on media query changes
    const mediaQuery = window.matchMedia('(max-width: 880px)');
    setDirection(mediaQuery.matches ? 'vertical' : 'horizontal');

    const handleChange = (e: MediaQueryListEvent) => {
      setDirection(e.matches ? 'vertical' : 'horizontal');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.forceVerticalLayout, direction]);

  useInsomniaTab({
    organizationId,
    projectId,
    workspaceId,
    activeWorkspace,
    unitTestSuite,
    activeProject,
  });

  return (
    <PanelGroup
      ref={sidebarPanelRef}
      autoSaveId="insomnia-sidebar"
      id="wrapper"
      className="new-sidebar h-full w-full text-[--color-font]"
      direction="horizontal"
    >
      <Panel
        id="sidebar"
        className="sidebar theme--sidebar divide-y divide-solid divide-[--hl-md]"
        defaultSize={DEFAULT_SIDEBAR_SIZE}
        maxSize={40}
        minSize={10}
        collapsible
      >
        <ErrorBoundary showAlert>
          <div className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden">
            <div className="flex flex-col items-start divide-y divide-solid divide-[--hl-md]">
              <Breadcrumbs
                className={`flex h-[${INSOMNIA_TAB_HEIGHT}px] m-0 w-full list-none items-center gap-2 px-[--padding-sm] font-bold`}
              >
                <Breadcrumb className="flex h-full select-none items-center gap-2 text-[--color-font] outline-none data-[focused]:outline-none">
                  <NavLink
                    data-testid="project"
                    className="flex aspect-square h-7 flex-shrink-0 items-center justify-center gap-2 rounded-sm px-1 py-1 text-sm text-[--color-font] outline-none ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] data-[focused]:outline-none"
                    to={`/organization/${organizationId}/project/${activeProject._id}`}
                  >
                    <Icon className="text-xs" icon="chevron-left" />
                  </NavLink>
                  <span aria-hidden role="separator" className="h-4 text-[--hl-lg] outline outline-1" />
                </Breadcrumb>
                <Breadcrumb className="flex h-full select-none items-center gap-2 truncate text-[--color-font] outline-none data-[focused]:outline-none">
                  <WorkspaceDropdown />
                </Breadcrumb>
              </Breadcrumbs>
              <DocumentTab organizationId={organizationId} projectId={projectId} workspaceId={workspaceId} />
              <div className="flex w-full flex-col items-start gap-2 p-[--padding-sm]">
                <div className="flex w-full items-center justify-between gap-2">
                  <EnvironmentPicker
                    isOpen={isEnvironmentPickerOpen}
                    onOpenChange={setIsEnvironmentPickerOpen}
                    onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
                  />
                </div>
                <Button
                  onPress={() => setIsCookieModalOpen(true)}
                  className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                >
                  <Icon icon="cookie-bite" className="w-5 flex-shrink-0" />
                  <span className="truncate">
                    {activeCookieJar.cookies.length === 0 ? 'Add' : 'Manage'} Cookies{' '}
                    {activeCookieJar.cookies.length > 0 ? `(${activeCookieJar.cookies.length})` : ''}
                  </span>
                </Button>
                <Button
                  onPress={() => setCertificatesModalOpen(true)}
                  className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                >
                  <Icon icon="file-contract" className="w-5 flex-shrink-0" />
                  <span className="truncate">
                    {clientCertificates.length === 0 || caCertificate ? 'Add' : 'Manage'} Certificates{' '}
                    {[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined)
                      .length > 0
                      ? `(${[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined).length})`
                      : ''}
                  </span>
                </Button>
              </div>
            </div>
            <div className="p-[--padding-sm]">
              <Button
                className="flex items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                onPress={() => {
                  createUnitTestSuiteFetcher.submit(
                    {
                      name: 'New Suite',
                    },
                    {
                      method: 'post',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/new`,
                    },
                  );
                }}
              >
                <Icon icon="plus" />
                New test suite
              </Button>
            </div>
            <GridList
              aria-label="Test Suites"
              items={unitTestSuites.map(suite => ({
                id: suite._id,
                key: suite._id,
                ...suite,
              }))}
              dragAndDropHooks={testSuitesDragAndDrop.dragAndDropHooks}
              className="flex-1 overflow-y-auto py-[--padding-sm] data-[empty]:py-0"
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
                  <GridListItem
                    key={item._id}
                    id={item._id}
                    textValue={item.name}
                    className="group w-full select-none outline-none"
                  >
                    <div
                      className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] group-aria-selected:text-[--color-font]"
                      title={item.name}
                    >
                      <span className="absolute left-0 top-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-[--color-surprise]" />
                      <Button slot="drag" className="hidden" />
                      <EditableInput
                        value={item.name}
                        name="name"
                        ariaLabel="Test suite name"
                        className="flex-1 px-1 hover:!bg-transparent"
                        onSubmit={name => {
                          name &&
                            updateTestSuiteFetcher.submit(
                              { name },
                              {
                                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${item._id}/update`,
                                method: 'POST',
                                encType: 'application/json',
                              },
                            );
                        }}
                      />
                      <MenuTrigger>
                        <Button
                          aria-label="Unit Test Actions"
                          className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-hover:opacity-100 group-focus:opacity-100 data-[pressed]:bg-[--hl-sm] data-[pressed]:opacity-100"
                        >
                          <Icon icon="caret-down" />
                        </Button>
                        <Popover className="flex min-w-max flex-col overflow-y-hidden">
                          <Menu
                            aria-label="Unit Test Actions Menu"
                            selectionMode="single"
                            onAction={key => {
                              testSuiteActionList.find(({ id }) => key === id)?.action(item._id, item.name);
                            }}
                            items={testSuiteActionList}
                            className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
                          >
                            {item => (
                              <MenuItem
                                key={item.id}
                                id={item.id}
                                className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                                aria-label={item.name}
                              >
                                <Icon icon={item.icon} />
                                <span>{item.name}</span>
                              </MenuItem>
                            )}
                          </Menu>
                        </Popover>
                      </MenuTrigger>
                    </div>
                  </GridListItem>
                );
              }}
            </GridList>
          </div>
          <WorkspaceSyncDropdown />
          {isEnvironmentModalOpen && <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />}
          {isCookieModalOpen && <CookiesModal setIsOpen={setIsCookieModalOpen} />}
          {isCertificatesModalOpen && <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />}
        </ErrorBoundary>
      </Panel>
      <PanelResizeHandle className="h-full w-[1px] bg-[--hl-md]" />
      <Panel className="flex flex-col">
        <OrganizationTabList />
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" minSize={10} className="pane-one theme--pane relative overflow-hidden">
            <Routes>
              <Route
                path={'test-suite/:testSuiteId/*'}
                element={
                  <Suspense>
                    <TestSuiteRoute />
                  </Suspense>
                }
              />
              <Route path="*" element={<div className="p-[--padding-md]">No test suite selected</div>} />
            </Routes>
          </Panel>
          <PanelResizeHandle
            className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'h-[1px] w-full bg-[--hl-md]'}
          />
          <Panel
            id="pane-two"
            minSize={10}
            className="pane-two theme--pane relative divide-y divide-solid divide-[--hl-md] overflow-hidden"
          >
            <Routes>
              <Route
                path="test-suite/:testSuiteId/test-result/:testResultId"
                element={
                  runningTests ? (
                    <>
                      <Heading className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center gap-2 px-[--padding-md] text-lg">
                        <Icon icon="spinner" className="fa-pulse" /> Running tests...
                      </Heading>
                      <div />
                    </>
                  ) : (
                    <TestRunStatus />
                  )
                }
              />
              <Route
                path="*"
                element={
                  <>
                    <Heading className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center gap-2 px-[--padding-md] text-lg">
                      {runningTests ? (
                        <>
                          <Icon icon="spinner" className="fa-pulse" /> Running tests...
                        </>
                      ) : (
                        'No test results'
                      )}
                    </Heading>
                    <div />
                  </>
                }
              />
            </Routes>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default TestRoute;
