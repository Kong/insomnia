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
} from 'react-router-dom';

import { DEFAULT_SIDEBAR_SIZE } from '../../common/constants';
import { database } from '../../common/database';
import { isNotNullOrUndefined } from '../../common/misc';
import * as models from '../../models';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { showModal } from '../../ui/components/modals';
import { AskModal } from '../../ui/components/modals/ask-modal';
import { invariant } from '../../utils/invariant';
import { DocumentTab } from '../components/document-tab';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '../components/editable-input';
import { EnvironmentPicker } from '../components/environment-picker';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showPrompt } from '../components/modals';
import { CookiesModal } from '../components/modals/cookies-modal';
import { CertificatesModal } from '../components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '../components/tabs/tab-list';
import { INSOMNIA_TAB_HEIGHT } from '../constant';
import { useInsomniaTab } from '../hooks/use-insomnia-tab';
import { useRootLoaderData } from './root';
import { TestRunStatus } from './test-results';
import TestSuiteRoute from './test-suite';
import type { WorkspaceLoaderData } from './workspace';

interface LoaderData {
  unitTestSuites: UnitTestSuite[];
}

export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId } = params;

  invariant(workspaceId, 'Workspace ID is required');

  const unitTestSuites = await database.find<UnitTestSuite>(
    models.unitTestSuite.type,
    {
      parentId: workspaceId,
    },
    {
      metaSortKey: 1,
    }
  );

  invariant(unitTestSuites, 'Unit test suites not found');

  return {
    unitTestSuites,
  };
};

const TestRoute: FC = () => {
  const { unitTestSuites } = useLoaderData() as LoaderData;
  const { settings } = useRootLoaderData();
  const { organizationId, projectId, workspaceId, testSuiteId } =
    useParams() as {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
    };

  const {
    activeProject,
    activeWorkspace,
    activeCookieJar,
    caCertificate,
    clientCertificates,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const { unitTestSuite } = useRouteLoaderData(
    ':testSuiteId'
  ) as { unitTestSuite: UnitTestSuite } || {};

  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  const createUnitTestSuiteFetcher = useFetcher();
  const deleteUnitTestSuiteFetcher = useFetcher();
  const updateTestSuiteFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const runningTests = useFetchers()
    .filter(
      fetcher =>
        fetcher.formAction?.includes('run-all-tests') ||
        fetcher.formAction?.includes('run')
    )
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
          }
        );
      },
    },
    {
        id: 'rename',
        name: 'Rename',
        icon: 'edit',
        action: suiteId => {
          showPrompt({
            title: 'Rename test suite',
            defaultValue: unitTestSuites.find(s => s._id === suiteId)?.name,
            submitName: 'Rename',
            onComplete: name => {
              name && updateTestSuiteFetcher.submit(
                { name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suiteId}/update`,
                  method: 'POST',
                  encType: 'application/json',
                }
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
                  }
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

      updateTestSuiteFetcher.submit({ metaSortKey: sourceTestSuite.metaSortKey }, {
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${sourceTestSuite._id}/update`,
        encType: 'application/json',
      });
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="outline-[--color-surprise] outline-1 outline"
        />
      );
    },
  });

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(settings.forceVerticalLayout ? 'vertical' : 'horizontal');
  useLayoutEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => { };
    } else {
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
    }
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
    <PanelGroup ref={sidebarPanelRef} autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel id="sidebar" className='sidebar theme--sidebar divide-solid divide-y divide-[--hl-md]' defaultSize={DEFAULT_SIDEBAR_SIZE} maxSize={40} minSize={10} collapsible>
        <ErrorBoundary showAlert>
          <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
            <div className="flex flex-col items-start divide-solid divide-y divide-[--hl-md]">
              <Breadcrumbs className={`flex h-[${INSOMNIA_TAB_HEIGHT}px] list-none items-center m-0 gap-2 px-[--padding-sm] font-bold w-full`}>
                <Breadcrumb className="flex select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
                  <NavLink
                    data-testid="project"
                    className="px-1 py-1 aspect-square h-7 flex flex-shrink-0 outline-none data-[focused]:outline-none items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    to={`/organization/${organizationId}/project/${activeProject._id}`}
                  >
                    <Icon className='text-xs' icon="chevron-left" />
                  </NavLink>
                  <span aria-hidden role="separator" className='text-[--hl-lg] h-4 outline outline-1' />
                </Breadcrumb>
                <Breadcrumb className="flex truncate select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
                  <WorkspaceDropdown />
                </Breadcrumb>
              </Breadcrumbs>
              <DocumentTab
                organizationId={organizationId}
                projectId={projectId}
                workspaceId={workspaceId}
              />
              <div className='flex flex-col items-start gap-2 p-[--padding-sm] w-full'>
                <div className="flex w-full items-center gap-2 justify-between">
                  <EnvironmentPicker
                    isOpen={isEnvironmentPickerOpen}
                    onOpenChange={setIsEnvironmentPickerOpen}
                    onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
                  />
                </div>
                <Button
                  onPress={() => setIsCookieModalOpen(true)}
                  className="px-4 py-1 max-w-full truncate flex-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                >
                  <Icon icon="cookie-bite" className='w-5 flex-shrink-0' />
                  <span className='truncate'>{activeCookieJar.cookies.length === 0 ? 'Add' : 'Manage'} Cookies {activeCookieJar.cookies.length > 0 ? `(${activeCookieJar.cookies.length})` : ''}</span>
                </Button>
                <Button
                  onPress={() => setCertificatesModalOpen(true)}
                  className="px-4 py-1 max-w-full truncate flex-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                >
                  <Icon icon="file-contract" className='w-5 flex-shrink-0' />
                  <span className='truncate'>{clientCertificates.length === 0 || caCertificate ? 'Add' : 'Manage'} Certificates {[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined).length > 0 ? `(${[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined).length})` : ''}</span>
                </Button>
              </div>
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
              aria-label="Test Suites"
              items={unitTestSuites.map(suite => ({
                id: suite._id,
                key: suite._id,
                ...suite,
              }))}
              dragAndDropHooks={testSuitesDragAndDrop.dragAndDropHooks}
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
                  <GridListItem
                    key={item._id}
                    id={item._id}
                    textValue={item.name}
                    className="group outline-none select-none w-full"
                  >
                    <div className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]" title={item.name}>
                      <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                      <Button slot="drag" className="hidden" />
                      <EditableInput
                        value={item.name}
                        name="name"
                        ariaLabel="Test suite name"
                        className='flex-1 px-1 hover:!bg-transparent'
                        onSubmit={name => {
                          name && updateTestSuiteFetcher.submit(
                            { name },
                            {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${item._id}/update`,
                              method: 'POST',
                              encType: 'application/json',
                            }
                          );
                        }}
                      />
                      <MenuTrigger>
                        <Button
                          aria-label="Unit Test Actions"
                          className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                        >
                          <Icon icon="caret-down" />
                        </Button>
                        <Popover className="min-w-max overflow-y-hidden flex flex-col">
                          <Menu
                            aria-label="Unit Test Actions Menu"
                            selectionMode="single"
                            onAction={key => {
                              testSuiteActionList
                                .find(({ id }) => key === id)
                                ?.action(item._id, item.name);
                            }}
                            items={testSuiteActionList}
                            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
                          >
                            {item => (
                              <MenuItem
                                key={item.id}
                                id={item.id}
                                className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
          {isEnvironmentModalOpen && (
            <WorkspaceEnvironmentsEditModal
              onClose={() => setEnvironmentModalOpen(false)}
            />
          )}
          {isCookieModalOpen && (
            <CookiesModal onHide={() => setIsCookieModalOpen(false)} />
          )}
          {isCertificatesModalOpen && (
            <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />
          )}
        </ErrorBoundary>
      </Panel>
      <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
      <Panel className='flex flex-col'>
        <OrganizationTabList />
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" minSize={10} className='pane-one theme--pane relative overflow-hidden'>
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
          </Panel>
          <PanelResizeHandle className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'w-full h-[1px] bg-[--hl-md]'} />
          <Panel id="pane-two" minSize={10} className='pane-two theme--pane divide-y divide-solid divide-[--hl-md] overflow-hidden relative'>
            <Routes>
              <Route
                path="test-suite/:testSuiteId/test-result/:testResultId"
                element={
                  runningTests ? (
                    <>
                      <Heading className="text-lg flex-shrink-0 flex items-center gap-2 w-full h-[--line-height-sm] px-[--padding-md]">
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
                    <Heading className="text-lg flex-shrink-0 flex items-center gap-2 w-full h-[--line-height-sm] px-[--padding-md]">
                      {runningTests ? (
                        <>
                          <Icon icon="spinner" className="fa-pulse" /> Running
                          tests...
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
