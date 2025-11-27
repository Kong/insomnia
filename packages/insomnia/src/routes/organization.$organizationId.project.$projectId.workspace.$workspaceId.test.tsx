import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  NavLink,
  Route as RouteComponent,
  Routes,
  useFetchers,
  useLoaderData,
  useNavigate,
  useParams,
} from 'react-router';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { database } from '~/common/database';
import { isNotNullOrUndefined } from '~/common/misc';
import * as models from '~/models';
import type { UnitTestSuite } from '~/models/unit-test-suite';
import { useRootLoaderData } from '~/root';
import { useTestSuiteDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.delete';
import { useRunAllTestsActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.run-all-tests';
import { TestRunStatus } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test-result.$testResultId';
import { useTestSuiteUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.update';
import { useTestSuiteNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.new';
import { DocumentTab } from '~/ui/components/document-tab';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '~/ui/components/editable-input';
import { EnvironmentPicker } from '~/ui/components/environment-picker';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { CookiesModal } from '~/ui/components/modals/cookies-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { CertificatesModal } from '~/ui/components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useInsomniaTab } from '~/ui/hooks/use-insomnia-tab';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test';
import { useWorkspaceLoaderData } from './organization.$organizationId.project.$projectId.workspace.$workspaceId';
import TestSuiteComponent, {
  useUnitTestSuiteLoaderData,
} from './organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
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
}

const Component = () => {
  const { unitTestSuites } = useLoaderData<typeof clientLoader>();
  const { settings } = useRootLoaderData()!;
  const { organizationId, projectId, workspaceId, testSuiteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    testSuiteId: string;
  };

  const { activeProject, activeWorkspace, activeCookieJar, caCertificate, clientCertificates } =
    useWorkspaceLoaderData()!;

  const { unitTestSuite } = useUnitTestSuiteLoaderData() || {};

  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  const createUnitTestSuiteFetcher = useTestSuiteNewActionFetcher();
  const deleteUnitTestSuiteFetcher = useTestSuiteDeleteActionFetcher();
  const updateTestSuiteFetcher = useTestSuiteUpdateActionFetcher();
  const runAllTestsFetcher = useRunAllTestsActionFetcher();
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
        runAllTestsFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          testSuiteId: suiteId,
        });
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
              updateTestSuiteFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                testSuiteId: suiteId,
                data: { name },
              });
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
              deleteUnitTestSuiteFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                testSuiteId: suiteId,
              });
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

      updateTestSuiteFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        testSuiteId: sourceTestSuite._id,
        data: { metaSortKey: sourceTestSuite.metaSortKey },
      });
    },
    renderDropIndicator(target) {
      return <DropIndicator target={target} className="outline-1 outline-(--color-surprise) outline-solid" />;
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
      className="new-sidebar h-full w-full text-(--color-font)"
      direction="horizontal"
    >
      <Panel
        id="sidebar"
        className="sidebar theme--sidebar divide-y divide-solid divide-(--hl-md)"
        defaultSize={DEFAULT_SIDEBAR_SIZE}
        maxSize={40}
        minSize={10}
        collapsible
      >
        <ErrorBoundary showAlert>
          <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
            <div className="flex flex-col items-start divide-y divide-solid divide-(--hl-md)">
              <div className="flex w-full flex-col items-start">
                <Breadcrumbs
                  className={`flex h-[${INSOMNIA_TAB_HEIGHT}px] m-0 w-full list-none items-center gap-2 px-(--padding-sm) font-bold`}
                >
                  <Breadcrumb className="flex h-full items-center gap-2 text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
                    <NavLink
                      data-testid="project"
                      className="flex aspect-square h-7 shrink-0 items-center justify-center gap-2 rounded-xs px-1 py-1 text-sm text-(--color-font) ring-1 ring-transparent outline-hidden transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-focused:outline-hidden"
                      to={`/organization/${organizationId}/project/${activeProject._id}`}
                    >
                      <Icon className="text-xs" icon="chevron-left" />
                    </NavLink>
                    <span aria-hidden role="separator" className="h-4 text-(--hl-lg) outline-1 outline-solid" />
                  </Breadcrumb>
                  <Breadcrumb className="flex h-full items-center gap-2 truncate text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
                    <WorkspaceDropdown />
                  </Breadcrumb>
                </Breadcrumbs>
              </div>
              <DocumentTab organizationId={organizationId} projectId={projectId} workspaceId={workspaceId} />
              <div className="flex w-full flex-col items-start gap-2 p-(--padding-sm)">
                <div className="flex w-full items-center justify-between gap-2">
                  <EnvironmentPicker
                    isOpen={isEnvironmentPickerOpen}
                    onOpenChange={setIsEnvironmentPickerOpen}
                    onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
                  />
                </div>
                <Button
                  onPress={() => setIsCookieModalOpen(true)}
                  className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="cookie-bite" className="w-5 shrink-0" />
                  <span className="truncate">
                    {activeCookieJar.cookies.length === 0 ? 'Add' : 'Manage'} Cookies{' '}
                    {activeCookieJar.cookies.length > 0 ? `(${activeCookieJar.cookies.length})` : ''}
                  </span>
                </Button>
                <Button
                  onPress={() => setCertificatesModalOpen(true)}
                  className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="file-contract" className="w-5 shrink-0" />
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
            <div className="p-(--padding-sm)">
              <Button
                className="flex items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                onPress={() => {
                  createUnitTestSuiteFetcher.submit({
                    organizationId,
                    projectId,
                    workspaceId,
                    name: 'New Suite',
                  });
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
              className="flex-1 overflow-y-auto py-(--padding-sm) data-empty:py-0"
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
                    className="group w-full outline-hidden select-none"
                  >
                    <div
                      className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)"
                      title={item.name}
                    >
                      <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
                      <Button slot="drag" className="hidden" />
                      <EditableInput
                        value={item.name}
                        name="name"
                        ariaLabel="Test suite name"
                        className="flex-1 px-1 hover:bg-transparent!"
                        onSubmit={name => {
                          name &&
                            updateTestSuiteFetcher.submit({
                              organizationId,
                              projectId,
                              workspaceId,
                              testSuiteId: item._id,
                              data: { name },
                            });
                        }}
                      />
                      <MenuTrigger>
                        <Button
                          aria-label="Unit Test Actions"
                          className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset data-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                          >
                            {item => (
                              <MenuItem
                                key={item.id}
                                id={item.id}
                                className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
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
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
      <Panel className="flex flex-col">
        <OrganizationTabList />
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" minSize={10} className="pane-one theme--pane relative overflow-hidden">
            <Routes>
              <RouteComponent
                path={'test-suite/:testSuiteId/*'}
                element={
                  <Suspense>
                    <TestSuiteComponent />
                  </Suspense>
                }
              />
              <RouteComponent path="*" element={<div className="p-(--padding-md)">No test suite selected</div>} />
            </Routes>
          </Panel>
          <PanelResizeHandle
            className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
          />
          <Panel
            id="pane-two"
            minSize={10}
            className="pane-two theme--pane relative divide-y divide-solid divide-(--hl-md) overflow-hidden"
          >
            <Routes>
              <RouteComponent
                path="test-suite/:testSuiteId/test-result/:testResultId"
                element={
                  runningTests ? (
                    <>
                      <Heading className="flex h-(--line-height-sm) w-full shrink-0 items-center gap-2 px-(--padding-md) text-lg">
                        <Icon icon="spinner" className="fa-pulse" /> Running tests...
                      </Heading>
                      <div />
                    </>
                  ) : (
                    <TestRunStatus />
                  )
                }
              />
              <RouteComponent
                path="*"
                element={
                  <>
                    <Heading className="flex h-(--line-height-sm) w-full shrink-0 items-center gap-2 px-(--padding-md) text-lg">
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

export default Component;
