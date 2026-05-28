import { type IRuleResult } from '@stoplight/spectral-core';
import CodeMirror from 'codemirror';
import type { OpenAPIV3 } from 'openapi-types';
import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
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
import { href, redirect, useLoaderData } from 'react-router';
import * as reactUse from 'react-use';
import { SwaggerUIBundle } from 'swagger-ui-dist';
import YAML from 'yaml';

import { parseApiSpec } from '~/common/api-specs';
import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { debounce } from '~/common/misc';
import { models, services } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import {
  useWorkspaceLoaderData,
  WORKSPACE_CONTENT_WRAPPER,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useSpecGenerateRequestCollectionActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.generate-request-collection';
import { useSpecUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.update';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { AnalyticsEvent } from '~/ui/analytics';
import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';
import { DesignEmptyState } from '~/ui/components/design-empty-state';
import { DocumentTab } from '~/ui/components/document-tab';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showError } from '~/ui/components/modals';
import { CookiesModal } from '~/ui/components/modals/cookies-modal';
import { NewWorkspaceModal } from '~/ui/components/modals/new-workspace-modal';
import { CertificatesModal } from '~/ui/components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { formatMethodName } from '~/ui/components/tags/method-tag';
import { showResourceNotFoundToast, showToast } from '~/ui/components/toast-notification';
import WorkspacePaneHeader from '~/ui/components/workspace/workspace-pane-header';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useAIFeatureStatus } from '~/ui/hooks/use-organization-features';
import { useGitVCSVersion } from '~/ui/hooks/use-vcs-version';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const project = await services.project.get(projectId);
  if (!project) {
    showResourceNotFoundToast(`Project not found: ${projectId}`);
    throw redirect(href('/organization/:organizationId/project', { organizationId }));
  }

  const workspace = await services.workspace.getById(workspaceId);
  if (!workspace) {
    showResourceNotFoundToast(`Workspace not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  const apiSpec = await services.apiSpec.getByParentId(workspaceId);
  if (!apiSpec) {
    showResourceNotFoundToast(`API Specification not found for workspace: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  const workspaceMeta = await services.workspaceMeta.getByParentId(workspaceId);

  const gitRepositoryId = models.project.isConnectedGitProject(project)
    ? models.project.getEffectiveRepoId(project)
    : workspaceMeta?.gitRepositoryId;
  // we don't run the lint here because it is expensive and slows first render too much
  // TODO: add this in once we run this loader outside the renderer
  const rulesetPath = gitRepositoryId
    ? window.path.join(window.app.getPath('userData'), `version-control/git/${gitRepositoryId}/.spectral.yaml`)
    : '';

  let parsedSpec: OpenAPIV3.Document | undefined;

  try {
    parsedSpec = YAML.parse(apiSpec.contents) as OpenAPIV3.Document;
  } catch {}

  return {
    apiSpec,
    rulesetPath,
    parsedSpec,
  };
}

const SwaggerUIDiv = ({ text }: { text: string }) => {
  useEffect(() => {
    let spec = {};
    try {
      spec = parseApiSpec(text).contents || {};
    } catch {}
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

const Component = ({ params }: Route.ComponentProps) => {
  const { organizationId, projectId, workspaceId } = params;
  const { activeProject, vcsVersion } = useWorkspaceLoaderData()!;
  const { settings } = useRootLoaderData()!;

  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [_isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);
  const [isNewMockServerModalOpen, setNewMockServerModalOpen] = useState(false);

  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });

  useEffect(() => {
    if (!models.organization.isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load({ organizationId });
    }
  }, [organizationId, storageRuleFetcher.load]);

  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);

  const { isGenerateMockServersWithAIEnabled } = useAIFeatureStatus();

  const { apiSpec, rulesetPath, parsedSpec } = useLoaderData<typeof clientLoader>();

  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);

  const editor = useRef<CodeEditorHandle>(null);
  const { submit: updateApiSpec } = useSpecUpdateActionFetcher();
  const generateRequestCollectionFetcher = useSpecGenerateRequestCollectionActionFetcher();
  const [isLintPaneOpen, setIsLintPaneOpen] = useState(false);
  const [isSpecPaneOpen, setIsSpecPaneOpen] = useState(Boolean(parsedSpec));

  const { components, info, servers, paths } = parsedSpec || {};
  const { requestBodies, responses, parameters, headers, schemas, securitySchemes } = components || {};

  const lintErrors = lintMessages.filter(message => message.type === 'error');
  const lintWarnings = lintMessages.filter(message => message.type === 'warning');

  const registerCodeMirrorLint = (rulesetPath: string) => {
    CodeMirror.registerHelper('lint', 'openapi', async (contents: string) => {
      try {
        const { diagnostics, error, cancelled } = await window.main.lintSpec({
          documentContent: contents,
          rulesetPath,
        });
        if (cancelled) {
          return;
        }
        if (error) {
          console.log('Handled error detected while linting:', error);
          showError({
            title: 'Linting Error',
            message: `An error occurred while linting the OpenAPI specification: ${error}`,
          });
          throw error;
        }
        const lintResult = diagnostics?.map(({ severity, code, message, range }) => {
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
        setLintMessages?.(lintResult || []);
        return lintResult;
      } catch (error) {
        // return a rejected promise so that codemirror do nothing
        console.log('Unhandled error while linting:', error);
        showError({
          title: 'Linting Error',
          message: `An error occurred while linting the OpenAPI specification: ${error}`,
        });
        throw error;
      }
    });
  };

  useEffect(() => {
    registerCodeMirrorLint(rulesetPath);
    // when first time into document editor, the lint helper register later than codemirror init, we need to trigger lint through execute setOption
    editor.current?.tryToSetOption('lint', { ...lintOptions });
  }, [rulesetPath]);

  reactUse.useUnmount(() => {
    // delete the helper to avoid it run multiple times when user enter the page next time
    CodeMirror.registerHelper('lint', 'openapi', () => {});
  });

  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      return updateApiSpec({
        organizationId,
        projectId,
        workspaceId,
        contents: contents,
      });
    };

    return debounce(handler, 500);
  }, [organizationId, projectId, updateApiSpec, workspaceId]);

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

  useDocBodyKeyboardShortcuts({
    environment_showEditor: () => setEnvironmentModalOpen(true),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
    showCookiesEditor: () => setIsCookieModalOpen(true),
  });

  const specFormat = useMemo((): 'json' | 'yaml' | null => {
    const contents = apiSpec.contents?.trim();
    if (!contents) {
      return null;
    }
    try {
      JSON.parse(contents);
      return 'json';
    } catch {
      return 'yaml';
    }
  }, [apiSpec.contents]);

  const switchFormat = (to: 'json' | 'yaml') => {
    const editorValue = editor.current?.getValue();
    if (!editorValue) {
      return;
    }
    let parsedSpec: string | undefined;
    try {
      // yaml parses json correctly
      parsedSpec = YAML.parse(editorValue);
    } catch {
      showToast({
        title: 'Failed to convert spec format',
        icon: 'circle-exclamation',
        status: 'error',
        description: `Spec is not valid, cannot convert to ${to.toUpperCase()}`,
      });
      return;
    }
    const contents = to === 'json' ? JSON.stringify(parsedSpec, null, 2) : YAML.stringify(parsedSpec);
    editor.current?.setValue(contents);
    updateApiSpec({ organizationId, projectId, workspaceId, contents });
  };

  const specActionList: SpecActionItem[] = [
    {
      id: 'generate-request-collection',
      name: 'Generate collection',
      icon: <Icon className="w-3" icon="file-code" />,
      isDisabled: !apiSpec.contents || lintErrors.length > 0 || generateRequestCollectionFetcher.state !== 'idle',
      action: () =>
        generateRequestCollectionFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
        }),
    },
    {
      id: 'toggle-preview',
      name: 'Toggle preview',
      icon: <Icon className="w-3" icon={isSpecPaneOpen ? 'eye' : 'eye-slash'} />,
      action: () => {
        window.main.trackAnalyticsEvent({
          event: AnalyticsEvent.designerPreviewToggled,
          properties: {
            status: !isSpecPaneOpen ? 'open' : 'collapsed',
          },
        });
        setIsSpecPaneOpen(!isSpecPaneOpen);
      },
    },
    ...(specFormat === 'json'
      ? [
          {
            id: 'convert-to-yaml',
            name: 'Convert to YAML',
            icon: <Icon className="w-3" icon="sync-alt" />,
            action: () => switchFormat('yaml'),
          },
        ]
      : specFormat === 'yaml'
        ? [
            {
              id: 'convert-to-json',
              name: 'Convert to JSON',
              icon: <Icon className="w-3" icon="sync-alt" />,
              action: () => switchFormat('json'),
            },
          ]
        : []),
  ];

  const disabledKeys = specActionList.filter(item => item.isDisabled).map(item => item.id);

  const gitVersion = useGitVCSVersion();
  const uniquenessKey = `${apiSpec?._id}::${apiSpec?.created}::${gitVersion}::${vcsVersion}`;

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

  return (
    <div className="flex h-full flex-col">
      <OrganizationTabList />
      <WorkspacePaneHeader hasSettings={false} />
      <PanelGroup
        ref={sidebarPanelRef}
        autoSaveId="insomnia-sidebar"
        id={WORKSPACE_CONTENT_WRAPPER}
        className="new-sidebar w-full flex-1 text-(--color-font)"
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
          <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
            <DocumentTab
              organizationId={organizationId}
              projectId={projectId}
              workspaceId={workspaceId}
              className="border-b border-solid border-(--hl-sm)"
            />
            <div className="flex shrink-0 items-center gap-2 p-(--padding-sm)">
              <Heading className="text-(--hl) uppercase">Spec</Heading>
              <span className="flex-1" />
              {isGenerateMockServersWithAIEnabled && (
                <Button
                  onPress={() => {
                    window.main.trackAnalyticsEvent({
                      event: AnalyticsEvent.designerGenerateMockClicked,
                    });
                    setNewMockServerModalOpen(true);
                  }}
                  isDisabled={!apiSpec.contents}
                  className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="server" className="w-5 shrink-0" />
                  <span className="truncate">Generate Mock</span>
                </Button>
              )}
              <ToggleButton
                aria-label="Toggle preview"
                isSelected={isSpecPaneOpen}
                className="flex h-full items-center justify-center gap-2 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                onChange={value => {
                  setIsSpecPaneOpen(value);
                  window.main.trackAnalyticsEvent({
                    event: AnalyticsEvent.designerPreviewToggled,
                    properties: {
                      status: !value ? 'open' : 'collapsed',
                    },
                  });
                }}
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
                  className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
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
                    className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                  >
                    {item => (
                      <MenuItem
                        className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:text-(--hl-md) aria-selected:font-bold"
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
            <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-y-auto">
              {/* Info */}
              {info && (
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <Button
                    className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                        className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
                        id="info.title"
                      >
                        <span className="truncate">Title: {info.title}</span>
                      </ListBoxItem>
                      <ListBoxItem
                        className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
                        id="info.description"
                      >
                        <span className="truncate">Description: {info.description}</span>
                      </ListBoxItem>
                      <ListBoxItem
                        className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
                        id="info.version"
                      >
                        <span className="truncate">Version: {info.version}</span>
                      </ListBoxItem>
                      <ListBoxItem
                        className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                        <GridListItem className="group outline-hidden select-none" id={`paths.${item.path}`}>
                          <div className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                            <span className="truncate">{item.path}</span>
                            <span className="flex-1" />
                            {getMethodsFromOpenApiPathItem(item).map(method => (
                              <Button
                                key={method}
                                onPress={() => navigateToPath(`paths.${item.path}.${method}`)}
                                className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] http-method-${method.toUpperCase()}`}
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
                <div className="divide-y divide-solid divide-(--hl-md)">
                  <div>
                    <Button
                      className="flex w-full items-center justify-between gap-2 p-(--padding-sm) text-sm text-(--hl) uppercase select-none hover:bg-(--hl-sm) focus:bg-(--hl-sm)"
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
                          className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm)"
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
            {isEnvironmentModalOpen && (
              <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />
            )}
            {isCookieModalOpen && <CookiesModal setIsOpen={setIsCookieModalOpen} />}
            {isCertificatesModalOpen && <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />}
            {isNewMockServerModalOpen && (
              <NewWorkspaceModal
                isOpen={isNewMockServerModalOpen}
                project={activeProject}
                storageRules={storageRules}
                scope="mock-server"
                sourceApiSpec={apiSpec}
                onOpenChange={setNewMockServerModalOpen}
              />
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
        <Panel className="flex flex-col">
          <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
            <Panel id="pane-one" minSize={10} className="pane-one theme--pane">
              <div className="flex h-full w-full flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
                <div className="relative flex flex-1 shrink-0 basis-1/2 overflow-hidden">
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
                        updateApiSpec({
                          organizationId,
                          projectId,
                          workspaceId,
                          contents: value,
                          fromTemplate: true,
                        });
                      }}
                    />
                  )}
                </div>
                {apiSpec.contents ? (
                  <div
                    className={`flex ${isLintPaneOpen ? '' : 'h-(--line-height-sm)'} box-border flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden`}
                  >
                    <div className="flex items-center gap-2 p-(--padding-sm)">
                      <TooltipTrigger>
                        <Button className="flex cursor-pointer items-center gap-2 select-none">
                          <Icon icon={rulesetPath ? 'file-circle-check' : 'file-circle-xmark'} />
                          Ruleset
                        </Button>
                        <Tooltip
                          placement="top end"
                          offset={8}
                          className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                        >
                          <div>
                            {rulesetPath ? (
                              <Fragment>
                                <p>Using ruleset from</p>
                                <code className="p-0 wrap-break-word">{rulesetPath}</code>
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
                        <div className="flex items-center gap-2 select-none">
                          <Icon icon="circle-xmark" className="text-(--color-danger)" />
                          {lintErrors.length}
                        </div>
                      )}
                      {lintWarnings.length > 0 && (
                        <div className="flex items-center gap-2 select-none">
                          <Icon icon="triangle-exclamation" className="text-(--color-warning)" />
                          {lintWarnings.length}
                        </div>
                      )}
                      {apiSpec.contents && (
                        <div className="flex items-center gap-2 select-none">
                          {lintMessages.length === 0 && <Icon icon="check-square" className="text-(--color-success)" />}
                          {lintMessages.length === 0 ? 'No lint problems' : 'Lint problems detected'}
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
                        className="flex-1 overflow-y-auto select-none"
                        onAction={index => {
                          const listIndex = Number.parseInt(index.toString(), 10);
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
                          <ListBoxItem className="flex items-center gap-2 p-(--padding-sm) text-xs outline-hidden transition-colors even:bg-(--hl-xs) focus-within:bg-(--hl-md) data-focused:bg-(--hl-md)">
                            <Icon
                              className={item.type === 'error' ? 'text-(--color-danger)' : 'text-(--color-warning)'}
                              icon={item.type === 'error' ? 'circle-xmark' : 'triangle-exclamation'}
                            />
                            <span className="truncate">{item.message}</span>
                            <span className="shrink-0 text-(--hl-lg)">[Ln {item.line}]</span>
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
                  className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
                />
                <Panel id="pane-two" minSize={10} className="pane-two theme--pane">
                  <SwaggerUIDiv text={apiSpec.contents} />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default Component;
