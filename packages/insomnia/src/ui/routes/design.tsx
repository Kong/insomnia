import { stat } from 'node:fs/promises';
import path from 'node:path';

import { type IRuleResult } from '@stoplight/spectral-core';
import CodeMirror from 'codemirror';
import type { OpenAPIV3 } from 'openapi-types';
import React, {
  type FC,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  GridList,
  GridListItem,
  Heading,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { type LoaderFunction, NavLink, useFetcher, useLoaderData, useParams, useRouteLoaderData } from 'react-router';
import { useUnmount } from 'react-use';
import { SwaggerUIBundle } from 'swagger-ui-dist';
import YAML from 'yaml';

import { parseApiSpec } from '../../common/api-specs';
import { ACTIVITY_SPEC, DEFAULT_SIDEBAR_SIZE } from '../../common/constants';
import { debounce, isNotNullOrUndefined } from '../../common/misc';
import type { ApiSpec } from '../../models/api-spec';
import * as models from '../../models/index';
import { isGitProject } from '../../models/project';
import { invariant } from '../../utils/invariant';
import { CodeEditor, type CodeEditorHandle } from '../components/codemirror/code-editor';
import { DesignEmptyState } from '../components/design-empty-state';
import { DocumentTab } from '../components/document-tab';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EnvironmentPicker } from '../components/environment-picker';
import { Icon } from '../components/icon';
import { InsomniaAI } from '../components/insomnia-ai-icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { CookiesModal } from '../components/modals/cookies-modal';
import { CertificatesModal } from '../components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '../components/tabs/tab-list';
import { formatMethodName } from '../components/tags/method-tag';
import { INSOMNIA_TAB_HEIGHT } from '../constant';
import { useAIContext } from '../context/app/ai-context';
import { useInsomniaTab } from '../hooks/use-insomnia-tab';
import { useActiveApiSpecSyncVCSVersion, useGitVCSVersion } from '../hooks/use-vcs-version';
import { SpectralRunner } from '../worker/spectral-handler';
import { useRootLoaderData } from './root';
import type { WorkspaceLoaderData } from './workspace';

interface LoaderData {
  apiSpec: ApiSpec;
  rulesetPath: string;
  parsedSpec?: OpenAPIV3.Document;
}

export const loader: LoaderFunction = async ({ params }): Promise<LoaderData> => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'API spec not found');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  let rulesetPath = '';

  try {
    const gitRepositoryId = isGitProject(project) ? project.gitRepositoryId : workspaceMeta?.gitRepositoryId;

    const spectralRulesetPath = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${gitRepositoryId}/other/.spectral.yaml`,
    );

    if ((await stat(spectralRulesetPath)).isFile()) {
      rulesetPath = spectralRulesetPath;
    }
  } catch (err) {
    // Ignore
  }
  let parsedSpec: OpenAPIV3.Document | undefined;

  try {
    parsedSpec = YAML.parse(apiSpec.contents) as OpenAPIV3.Document;
  } catch {}

  return {
    apiSpec,
    rulesetPath,
    parsedSpec,
  };
};

const SwaggerUIDiv = ({ text }: { text: string }) => {
  useEffect(() => {
    let spec = {};
    try {
      spec = parseApiSpec(text).contents || {};
    } catch (err) {}
    SwaggerUIBundle({ spec, dom_id: '#swagger-ui' });
  }, [text]);
  return (
    <div
      id="swagger-ui"
      style={{
        overflowY: 'auto',
        height: '100%',
        background: '#FFF',
      }}
    />
  );
};

interface LintMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  range: IRuleResult['range'];
}

interface SpecActionItem {
  id: string;
  name: string;
  icon: ReactNode;
  isDisabled?: boolean;
  action: () => void;
}

const getMethodsFromOpenApiPathItem = (pathItem: OpenAPIV3.PathItemObject): string[] => {
  const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].filter(
    method =>
      // @ts-expect-error -- shrug I don't care what pathItem has in it
      pathItem[method],
  );

  return methods;
};

const lintOptions = {
  delay: 1000,
};

const Design: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { activeProject, activeCookieJar, caCertificate, clientCertificates, activeWorkspace } = useRouteLoaderData(
    ':workspaceId',
  ) as WorkspaceLoaderData;
  const { settings } = useRootLoaderData();

  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);
  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);

  const { apiSpec, rulesetPath, parsedSpec } = useLoaderData() as LoaderData;

  const editor = useRef<CodeEditorHandle>(null);
  const { generating, generateTestsFromSpec, access } = useAIContext();
  const updateApiSpecFetcher = useFetcher();
  const generateRequestCollectionFetcher = useFetcher();
  const [isLintPaneOpen, setIsLintPaneOpen] = useState(false);
  const [isSpecPaneOpen, setIsSpecPaneOpen] = useState(Boolean(parsedSpec));

  const { components, info, servers, paths } = parsedSpec || {};
  const { requestBodies, responses, parameters, headers, schemas, securitySchemes } = components || {};

  const lintErrors = lintMessages.filter(message => message.type === 'error');
  const lintWarnings = lintMessages.filter(message => message.type === 'warning');

  const spectralRunnerRef = useRef<SpectralRunner>();

  const registerCodeMirrorLint = (rulesetPath: string) => {
    CodeMirror.registerHelper('lint', 'openapi', async (contents: string) => {
      let runner = spectralRunnerRef.current;

      if (!runner) {
        runner = new SpectralRunner();
        spectralRunnerRef.current = runner;
      }

      try {
        const diagnostics = await runner.runDiagnostics({ contents, rulesetPath });
        const lintResult = diagnostics.map(({ severity, code, message, range }) => {
          return {
            from: CodeMirror.Pos(range.start.line, range.start.character),
            to: CodeMirror.Pos(range.end.line, range.end.character),
            message: `${code} ${message}`,
            severity: ['error', 'warning'][severity] ?? 'info',
            type: (['error', 'warning'][severity] ?? 'info') as LintMessage['type'],
            range,
            line: range.start.line,
          };
        });
        setLintMessages?.(lintResult);
        return lintResult;
      } catch (e) {
        // return a rejected promise so that codemirror do nothing
        return Promise.reject(e);
      }
    });
  };

  useEffect(() => {
    registerCodeMirrorLint(rulesetPath);
    // when first time into document editor, the lint helper register later than codemirror init, we need to trigger lint through execute setOption
    editor.current?.tryToSetOption('lint', { ...lintOptions });
  }, [rulesetPath]);

  useUnmount(() => {
    // delete the helper to avoid it run multiple times when user enter the page next time
    CodeMirror.registerHelper('lint', 'openapi', undefined);
    spectralRunnerRef.current?.terminate();
  });

  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      updateApiSpecFetcher.submit(
        {
          contents: contents,
        },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/update`,
          method: 'post',
        },
      );
    };

    return debounce(handler, 500);
  }, [organizationId, projectId, updateApiSpecFetcher, workspaceId]);

  const handleScrollToSelection = useCallback(
    (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      if (!editor.current) {
        return;
      }
      editor.current.scrollToSelection(chStart, chEnd, lineStart, lineEnd);
    },
    [editor],
  );

  const handleScrollToLintMessage = useCallback(
    (notice: LintMessage) => {
      if (!editor.current) {
        return;
      }
      if (!notice.range) {
        return;
      }
      const { start, end } = notice.range;
      editor.current.scrollToSelection(start.character, end.character, start.line, end.line);
    },
    [editor],
  );

  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const navigateToPath = (path: string): void => {
    const pathSegments = path.split('.');
    const scrollPosition = {
      start: { line: 0, col: 0 },
      end: { line: 0, col: 200 },
    };

    try {
      JSON.parse(apiSpec.contents);
      // Account for JSON (as string) line number shift
      scrollPosition.start.line = 1;
    } catch {}

    const lineCounter = new YAML.LineCounter();
    const doc = YAML.parseDocument(apiSpec.contents, { lineCounter });
    const astNode = doc.getIn(pathSegments, true) as YAML.Node;
    const nodePosition = astNode.range && lineCounter.linePos(astNode.range[0]);
    if (nodePosition) {
      scrollPosition.start.line += nodePosition.line;
    }
    const isServersSection = pathSegments[0] === 'servers';
    if (!isServersSection) {
      scrollPosition.start.line -= 1;
    }

    scrollPosition.end.line = scrollPosition.start.line;
    // NOTE: We're subtracting 1 from everything because YAML CST uses
    //   1-based indexing and we use 0-based.
    handleScrollToSelection(
      scrollPosition.start.col - 1,
      scrollPosition.end.col - 1,
      scrollPosition.start.line - 1,
      scrollPosition.end.line - 1,
    );
  };

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

  const specActionList: SpecActionItem[] = [
    {
      id: 'ai-generate-tests-in-collection',
      name: 'Generate tests',
      action: generateTestsFromSpec,
      isDisabled: !access.enabled || generating,
      icon: <InsomniaAI className="w-3" />,
    },
    {
      id: 'generate-request-collection',
      name: 'Generate collection',
      icon: <Icon className="w-3" icon="file-code" />,
      isDisabled: !apiSpec.contents || lintErrors.length > 0 || generateRequestCollectionFetcher.state !== 'idle',
      action: () =>
        generateRequestCollectionFetcher.submit(
          {},
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/generate-request-collection`,
            method: 'POST',
          },
        ),
    },
    {
      id: 'toggle-preview',
      name: 'Toggle preview',
      icon: <Icon className="w-3" icon={isSpecPaneOpen ? 'eye' : 'eye-slash'} />,
      action: () => setIsSpecPaneOpen(!isSpecPaneOpen),
    },
  ];

  const disabledKeys = specActionList.filter(item => item.isDisabled).map(item => item.id);

  const gitVersion = useGitVCSVersion();
  const syncVersion = useActiveApiSpecSyncVCSVersion();
  const uniquenessKey = `${apiSpec?._id}::${apiSpec?.created}::${gitVersion}::${syncVersion}`;

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
        className="sidebar theme--sidebar"
        defaultSize={DEFAULT_SIDEBAR_SIZE}
        maxSize={40}
        minSize={10}
        collapsible
      >
        <div className="flex h-full flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden">
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
          <DocumentTab
            organizationId={organizationId}
            projectId={projectId}
            workspaceId={workspaceId}
            className="border-b border-solid border-[--hl-sm]"
          />
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
          <div className="flex flex-shrink-0 items-center gap-2 p-[--padding-sm]">
            <Heading className="uppercase text-[--hl]">Spec</Heading>
            <span className="flex-1" />
            <ToggleButton
              aria-label="Toggle preview"
              isSelected={isSpecPaneOpen}
              className="flex h-full items-center justify-center gap-2 rounded-sm px-2 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              onChange={setIsSpecPaneOpen}
            >
              {({ isSelected }) => (
                <>
                  <Icon icon={isSelected ? 'eye' : 'eye-slash'} />
                  <span>Preview</span>
                </>
              )}
            </ToggleButton>
            <MenuTrigger>
              <Button
                aria-label="Spec actions"
                className="flex aspect-square h-full items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              >
                <Icon icon="gear" />
              </Button>
              <Popover className="flex min-w-max flex-col overflow-y-hidden">
                <Menu
                  aria-label="Spec actions menu"
                  selectionMode="single"
                  disabledKeys={disabledKeys}
                  onAction={key => {
                    const item = specActionList.find(item => item.id === key);
                    if (item) {
                      item.action();
                    }
                  }}
                  items={specActionList}
                  className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
                >
                  {item => (
                    <MenuItem
                      className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:text-[--hl-md] aria-selected:font-bold"
                      aria-label={item.name}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </MenuItem>
                  )}
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-md] overflow-y-auto">
            {/* Info */}
            {info && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <Button
                  className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                  onPress={() => {
                    expandedKeys.includes('info')
                      ? setExpandedKeys(expandedKeys.filter(key => key !== 'info'))
                      : setExpandedKeys([...expandedKeys, 'info']);
                  }}
                >
                  <span className="truncate">Info</span>
                  <Icon icon={expandedKeys.includes('info') ? 'minus' : 'plus'} className="text-xs" />
                </Button>
                {/* Info */}
                {expandedKeys.includes('info') && (
                  <ListBox onAction={key => navigateToPath(key.toString())}>
                    <ListBoxItem
                      className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                      id="info.title"
                    >
                      <span className="truncate">Title: {info.title}</span>
                    </ListBoxItem>
                    <ListBoxItem
                      className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                      id="info.description"
                    >
                      <span className="truncate">Description: {info.description}</span>
                    </ListBoxItem>
                    <ListBoxItem
                      className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                      id="info.version"
                    >
                      <span className="truncate">Version: {info.version}</span>
                    </ListBoxItem>
                    <ListBoxItem
                      className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                      id="info.license"
                    >
                      <span className="truncate">License: {info.license?.name}</span>
                    </ListBoxItem>
                  </ListBox>
                )}
              </div>
            )}
            {/* Servers */}
            {servers && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('servers')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'servers'))
                        : setExpandedKeys([...expandedKeys, 'servers']);
                    }}
                  >
                    <span className="truncate">Servers</span>
                    <Icon icon={expandedKeys.includes('servers') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('servers') && (
                  <ListBox
                    items={servers.map((server, index) => ({
                      path: index,
                      ...server,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`servers.${item.path}`}
                      >
                        {item.url}
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Paths */}
            {paths && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('paths')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'paths'))
                        : setExpandedKeys([...expandedKeys, 'paths']);
                    }}
                  >
                    <span className="truncate">Paths</span>
                    <Icon icon={expandedKeys.includes('paths') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('paths') && (
                  <GridList
                    items={Object.entries(paths).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <GridListItem className="group select-none outline-none" id={`paths.${item.path}`}>
                        <div className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] group-aria-selected:text-[--color-font]">
                          <span className="truncate">{item.path}</span>
                          <span className="flex-1" />
                          {getMethodsFromOpenApiPathItem(item).map(method => (
                            <Button
                              key={method}
                              onPress={() => navigateToPath(`paths.${item.path}.${method}`)}
                              className={`flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] text-[0.65rem] http-method-${method.toUpperCase()}`}
                            >
                              {formatMethodName(method.toUpperCase())}
                            </Button>
                          ))}
                        </div>
                      </GridListItem>
                    )}
                  </GridList>
                )}
              </div>
            )}
            {/* RequestBodies */}
            {requestBodies && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('requestBodies')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'requestBodies'))
                        : setExpandedKeys([...expandedKeys, 'requestBodies']);
                    }}
                  >
                    <span className="truncate">Request bodies</span>
                    <Icon icon={expandedKeys.includes('requestBodies') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('requestBodies') && (
                  <ListBox
                    items={Object.entries(requestBodies).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`components.requestBodies.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Responses */}
            {responses && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('responses')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'responses'))
                        : setExpandedKeys([...expandedKeys, 'responses']);
                    }}
                  >
                    <span className="truncate">Responses</span>
                    <Icon icon={expandedKeys.includes('responses') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('responses') && (
                  <ListBox
                    items={Object.entries(responses).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`components.responses.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Parameters */}
            {parameters && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('parameters')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'parameters'))
                        : setExpandedKeys([...expandedKeys, 'parameters']);
                    }}
                  >
                    <span className="truncate">Parameters</span>
                    <Icon icon={expandedKeys.includes('parameters') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('parameters') && (
                  <ListBox
                    items={Object.entries(parameters).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`components.parameters.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Headers */}
            {headers && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('headers')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'headers'))
                        : setExpandedKeys([...expandedKeys, 'headers']);
                    }}
                  >
                    <span className="truncate">Headers</span>
                    <Icon icon={expandedKeys.includes('headers') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('headers') && (
                  <ListBox
                    items={Object.entries(headers).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`components.headers.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Schemas */}
            {schemas && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('schemas')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'schemas'))
                        : setExpandedKeys([...expandedKeys, 'schemas']);
                    }}
                  >
                    <span className="truncate">Schemas</span>
                    <Icon icon={expandedKeys.includes('schemas') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('schemas') && (
                  <ListBox
                    items={Object.entries(schemas).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`components.schemas.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Security */}
            {securitySchemes && (
              <div className="divide-y divide-solid divide-[--hl-md]">
                <div>
                  <Button
                    className="flex w-full select-none items-center justify-between gap-2 p-[--padding-sm] text-sm uppercase text-[--hl] hover:bg-[--hl-sm] focus:bg-[--hl-sm]"
                    onPress={() => {
                      expandedKeys.includes('security')
                        ? setExpandedKeys(expandedKeys.filter(key => key !== 'security'))
                        : setExpandedKeys([...expandedKeys, 'security']);
                    }}
                  >
                    <span className="truncate">Security</span>
                    <Icon icon={expandedKeys.includes('security') ? 'minus' : 'plus'} className="text-xs" />
                  </Button>
                </div>
                {expandedKeys.includes('security') && (
                  <ListBox
                    items={Object.entries(securitySchemes).map(([path, item]) => ({
                      ...item,
                      id: path,
                      path,
                    }))}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <ListBoxItem
                        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm]"
                        id={`components.securitySchemes.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                )}
              </div>
            )}
          </div>
          <WorkspaceSyncDropdown />
          {isEnvironmentModalOpen && <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />}
          {isCookieModalOpen && <CookiesModal setIsOpen={setIsCookieModalOpen} />}
          {isCertificatesModalOpen && <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />}
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-[1px] bg-[--hl-md]" />
      <Panel className="flex flex-col">
        <OrganizationTabList />
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" minSize={10} className="pane-one theme--pane">
            <div className="flex h-full w-full flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden">
              <div className="relative flex flex-1 flex-shrink-0 basis-1/2 overflow-hidden">
                <CodeEditor
                  id="spec-editor"
                  key={uniquenessKey}
                  showPrettifyButton
                  ref={editor}
                  lintOptions={lintOptions}
                  // only set the openapi mode if there are contents
                  mode={apiSpec.contents ? 'openapi' : undefined}
                  defaultValue={apiSpec.contents || ''}
                  onChange={onCodeEditorChange}
                  uniquenessKey={uniquenessKey}
                />
                {apiSpec.contents ? null : (
                  <DesignEmptyState
                    onImport={value => {
                      updateApiSpecFetcher.submit(
                        {
                          contents: value,
                          fromSync: 'true',
                        },
                        {
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/update`,
                          method: 'post',
                        },
                      );
                    }}
                  />
                )}
              </div>
              {apiSpec.contents ? (
                <div
                  className={`flex ${isLintPaneOpen ? '' : 'h-[--line-height-sm]'} box-border flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden`}
                >
                  <div className="flex items-center gap-2 p-[--padding-sm]">
                    <TooltipTrigger>
                      <Button className="flex cursor-pointer select-none items-center gap-2">
                        <Icon icon={rulesetPath ? 'file-circle-check' : 'file-circle-xmark'} />
                        Ruleset
                      </Button>
                      <Tooltip
                        placement="top end"
                        offset={8}
                        className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                      >
                        <div>
                          {rulesetPath ? (
                            <Fragment>
                              <p>Using ruleset from</p>
                              <code className="break-words p-0">{rulesetPath}</code>
                            </Fragment>
                          ) : (
                            <Fragment>
                              <p>Using default OAS ruleset.</p>
                              <p>
                                To use a custom ruleset add a <code className="p-0">.spectral.yaml</code> file to the
                                root of your git repository
                              </p>
                            </Fragment>
                          )}
                        </div>
                      </Tooltip>
                    </TooltipTrigger>
                    {lintErrors.length > 0 && (
                      <div className="flex select-none items-center gap-2">
                        <Icon icon="circle-xmark" className="text-[--color-danger]" />
                        {lintErrors.length}
                      </div>
                    )}
                    {lintWarnings.length > 0 && (
                      <div className="flex select-none items-center gap-2">
                        <Icon icon="triangle-exclamation" className="text-[--color-warning]" />
                        {lintWarnings.length}
                      </div>
                    )}
                    {lintMessages.length === 0 && apiSpec.contents && (
                      <div className="flex select-none items-center gap-2">
                        <Icon icon="check-square" className="text-[--color-success]" />
                        No lint problems
                      </div>
                    )}
                    <span className="flex-1" />
                    {lintMessages.length > 0 && (
                      <Button aria-label="Toggle lint panel" onPress={() => setIsLintPaneOpen(!isLintPaneOpen)}>
                        <Icon icon={isLintPaneOpen ? 'chevron-down' : 'chevron-up'} />
                      </Button>
                    )}
                  </div>
                  {isLintPaneOpen && (
                    <ListBox
                      className="flex-1 select-none overflow-y-auto"
                      onAction={index => {
                        const listIndex = parseInt(index.toString(), 10);
                        const lintMessage = lintMessages[listIndex];
                        handleScrollToLintMessage(lintMessage);
                      }}
                      items={lintMessages.map((message, index) => ({
                        ...message,
                        id: index,
                        value: message,
                      }))}
                    >
                      {item => (
                        <ListBoxItem className="flex items-center gap-2 p-[--padding-sm] text-xs outline-none transition-colors even:bg-[--hl-xs] focus-within:bg-[--hl-md] data-[focused]:bg-[--hl-md]">
                          <Icon
                            className={item.type === 'error' ? 'text-[--color-danger]' : 'text-[--color-warning]'}
                            icon={item.type === 'error' ? 'circle-xmark' : 'triangle-exclamation'}
                          />
                          <span className="truncate">{item.message}</span>
                          <span className="flex-shrink-0 text-[--hl-lg]">[Ln {item.line}]</span>
                        </ListBoxItem>
                      )}
                    </ListBox>
                  )}
                </div>
              ) : null}
            </div>
          </Panel>
          {isSpecPaneOpen && (
            <>
              <PanelResizeHandle
                className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'h-[1px] w-full bg-[--hl-md]'}
              />
              <Panel id="pane-two" minSize={10} className="pane-two theme--pane">
                <SwaggerUIDiv text={apiSpec.contents} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default Design;
