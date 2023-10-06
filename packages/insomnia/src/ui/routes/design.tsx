import type { IRuleResult } from '@stoplight/spectral-core';
import CodeMirror from 'codemirror';
import { stat } from 'fs/promises';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';
import React, {
  createRef,
  FC,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import {
  LoaderFunction,
  NavLink,
  useFetcher,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { SwaggerUIBundle } from 'swagger-ui-dist';
import YAML from 'yaml';
import YAMLSourceMap from 'yaml-source-map';

import { parseApiSpec } from '../../common/api-specs';
import { ACTIVITY_SPEC } from '../../common/constants';
import { debounce } from '../../common/misc';
import { ApiSpec } from '../../models/api-spec';
import { Environment } from '../../models/environment';
import * as models from '../../models/index';
import { invariant } from '../../utils/invariant';
import {
  CodeEditor,
  CodeEditorHandle,
} from '../components/codemirror/code-editor';
import { DesignEmptyState } from '../components/design-empty-state';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { Icon } from '../components/icon';
import { InsomniaAI } from '../components/insomnia-ai-icon';
import { CookiesModal } from '../components/modals/cookies-modal';
import { WorkspaceEnvironmentsEditModal } from '../components/modals/workspace-environments-edit-modal';
import { SidebarLayout } from '../components/sidebar-layout';
import { formatMethodName } from '../components/tags/method-tag';
import { useAIContext } from '../context/app/ai-context';
import {
  useActiveApiSpecSyncVCSVersion,
  useGitVCSVersion,
} from '../hooks/use-vcs-version';
import { WorkspaceLoaderData } from './workspace';

interface LoaderData {
  lintMessages: LintMessage[];
  apiSpec: ApiSpec;
  rulesetPath: string;
  parsedSpec?: OpenAPIV3.Document;
}

export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  const apiSpec = await models.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'API spec not found');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  let lintMessages: LintMessage[] = [];

  let rulesetPath = '';

  try {
    const spectralRulesetPath = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${workspaceMeta?.gitRepositoryId}/other/.spectral.yaml`
    );

    if ((await stat(spectralRulesetPath)).isFile()) {
      rulesetPath = spectralRulesetPath;
    }
  } catch (err) {
    // Ignore
  }

  if (apiSpec.contents && apiSpec.contents.length !== 0) {
    try {
      lintMessages = (
        await window.main.spectralRun({
          contents: apiSpec.contents,
          rulesetPath,
        })
      ).map(({ severity, code, message, range }) => ({
        type: (['error', 'warning'][severity] ?? 'info') as LintMessage['type'],
        message: `${code} ${message}`,
        line: range.start.line,
        range,
      }));
    } catch (e) {
      console.log('Error linting spec', e);
    }
  }

  let parsedSpec: OpenAPIV3.Document | undefined;

  try {
    parsedSpec = YAML.parse(apiSpec.contents) as OpenAPIV3.Document;
  } catch (error) {
    console.log('Error parsing spec', error);
  }

  return {
    lintMessages,
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

const getMethodsFromOpenApiPathItem = (
  pathItem: OpenAPIV3.PathItemObject
): string[] => {
  const OpenApiV3Methods = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
  ] satisfies (keyof OpenAPIV3.PathItemObject)[];

  const methods = OpenApiV3Methods.filter(method => pathItem[method]);

  return methods;
};

const Design: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
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

  const { apiSpec, lintMessages, rulesetPath, parsedSpec } = useLoaderData() as LoaderData;

  const editor = createRef<CodeEditorHandle>();
  const { generating, generateTestsFromSpec, access } = useAIContext();
  const updateApiSpecFetcher = useFetcher();
  const generateRequestCollectionFetcher = useFetcher();
  const [isLintPaneOpen, setIsLintPaneOpen] = useState(false);
  const [isSpecPaneOpen, setIsSpecPaneOpen] = useState(true);

  const { components, info, servers, paths } = parsedSpec || {};
  const {
    requestBodies,
    responses,
    parameters,
    headers,
    schemas,
    securitySchemes,
  } = components || {};

  const lintErrors = lintMessages.filter(message => message.type === 'error');
  const lintWarnings = lintMessages.filter(
    message => message.type === 'warning'
  );

  useEffect(() => {
    CodeMirror.registerHelper('lint', 'openapi', async (contents: string) => {
      const diagnostics = await window.main.spectralRun({
        contents,
        rulesetPath,
      });

      return diagnostics.map(result => ({
        from: CodeMirror.Pos(
          result.range.start.line,
          result.range.start.character
        ),
        to: CodeMirror.Pos(result.range.end.line, result.range.end.character),
        message: result.message,
        severity: ['error', 'warning'][result.severity] ?? 'info',
      }));
    });
  }, [rulesetPath]);

  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      updateApiSpecFetcher.submit(
        {
          contents: contents,
        },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/update`,
          method: 'post',
        }
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
    [editor]
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
      editor.current.scrollToSelection(
        start.character,
        end.character,
        start.line,
        end.line
      );
    },
    [editor]
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

    const sourceMap = new YAMLSourceMap();
    const specMap = sourceMap.index(
      YAML.parseDocument(apiSpec.contents, {
        keepCstNodes: true,
      })
    );
    const itemMappedPosition = sourceMap.lookup(pathSegments, specMap);
    if (itemMappedPosition) {
      scrollPosition.start.line += itemMappedPosition.start.line;
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
      scrollPosition.end.line - 1
    );
  };

  const specActionList: SpecActionItem[] = [
    {
      id: 'ai-generate-tests-in-collection',
      name: 'Generate tests',
      action: generateTestsFromSpec,
      isDisabled: !access.enabled || generating,
      icon: <InsomniaAI className='w-3' />,
    },
    {
      id: 'generate-request-collection',
      name: 'Generate requests from spec',
      icon: <Icon className='w-3' icon="file-code" />,
      isDisabled:
        !apiSpec.contents ||
        lintErrors.length > 0 ||
        generateRequestCollectionFetcher.state !== 'idle',
      action: () =>
        generateRequestCollectionFetcher.submit(
          {},
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/generate-request-collection`,
            method: 'POST',
          }
        ),
    },
    {
      id: 'toggle-preview',
      name: 'Toggle preview',
      icon: <Icon className='w-3' icon={isSpecPaneOpen ? 'eye' : 'eye-slash'} />,
      action: () => setIsSpecPaneOpen(!isSpecPaneOpen),
    },
  ];

  const disabledKeys = specActionList
    .filter(item => item.isDisabled)
    .map(item => item.id);

  const gitVersion = useGitVCSVersion();
  const syncVersion = useActiveApiSpecSyncVCSVersion();
  const uniquenessKey = `${apiSpec?._id}::${apiSpec?.created}::${gitVersion}::${syncVersion}`;

  return (
    <SidebarLayout
      className='[&_.sidebar]:flex [&_.sidebar]:flex-col [&_.sidebar]:w-full [&_.sidebar]:h-full'
      renderPageSidebar={
        <div className='flex h-full flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden'>
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
          <div className="flex flex-shrink-0 items-center gap-2 p-[--padding-sm]">
            <Heading className="text-[--hl] uppercase">Spec</Heading>
            <span className="flex-1" />
            <ToggleButton
              aria-label="Toggle preview"
              isSelected={isSpecPaneOpen}
              className="flex items-center justify-center gap-2 px-2 h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
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
                className="flex items-center justify-center h-full aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              >
                <Icon icon="gear" />
              </Button>
              <Popover className="min-w-max">
                <Menu
                  aria-label="Spec actions menu"
                  selectionMode="single"
                  disabledKeys={disabledKeys}
                  onAction={key => {
                    const item = specActionList.find(
                      item => item.id === key
                    );
                    if (item) {
                      item.action();
                    }
                  }}
                  items={specActionList}
                  className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                >
                  {item => (
                    <Item
                      className="flex gap-2 aria-disabled:text-[--hl-md] aria-disabled:cursor-not-allowed px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                      aria-label={item.name}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </Item>
                  )}
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>
          <div className="flex-1 flex flex-col divide-y divide-solid divide-[--hl-md] overflow-y-auto">
            {/* Info */}
            {info && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('info')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'info')
                          )
                        : setExpandedKeys([...expandedKeys, 'info']);
                    }}
                  >
                    <span className='truncate'>Info</span>
                    <Icon
                      icon={expandedKeys.includes('info') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
                  </Button>
                {/* Info */}
                {expandedKeys.includes('info') && (
                  <ListBox onAction={key => navigateToPath(key.toString())}>
                    <Item
                      className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                      id="info.title"
                    >
                      <span className="truncate">Title: {info.title}</span>
                    </Item>
                    <Item
                      className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                      id="info.description"
                    >
                      <span className="truncate">
                        Description: {info.description}
                      </span>
                    </Item>
                    <Item
                      className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                      id="info.version"
                    >
                      <span className="truncate">Version: {info.version}</span>
                    </Item>
                    <Item
                      className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                      id="info.license"
                    >
                      <span className="truncate">
                        License: {info.license?.name}
                      </span>
                    </Item>
                  </ListBox>
                )}
              </div>
            )}
            {/* Servers */}
            {servers && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('servers')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'servers')
                          )
                        : setExpandedKeys([...expandedKeys, 'servers']);
                    }}
                  >
                    <span className='truncate'>Servers</span>
                    <Icon
                      icon={expandedKeys.includes('servers') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
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
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`servers.${item.path}`}
                      >
                        {item.url}
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Paths */}
            {paths && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('paths')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'paths')
                          )
                        : setExpandedKeys([...expandedKeys, 'paths']);
                    }}
                  >
                    <span className='truncate'>Paths</span>
                    <Icon
                      icon={expandedKeys.includes('paths') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
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
                      <Item
                        className="group outline-none select-none"
                        id={`paths.${item.path}`}
                      >
                        <div className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]">
                          <span className="truncate">{item.path}</span>
                          <span className="flex-1" />
                          {getMethodsFromOpenApiPathItem(item).map(method => (
                            <Button
                              key={method}
                              onPress={() =>
                                navigateToPath(`paths.${item.path}.${method}`)
                              }
                              className={`w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center http-method-${method.toUpperCase()}`}
                            >
                              {formatMethodName(method.toUpperCase())}
                            </Button>
                          ))}
                        </div>
                      </Item>
                    )}
                  </GridList>
                )}
              </div>
            )}
            {/* RequestBodies */}
            {requestBodies && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('requestBodies')
                        ? setExpandedKeys(
                            expandedKeys.filter(
                              key => key !== 'requestBodies'
                            )
                          )
                        : setExpandedKeys([...expandedKeys, 'requestBodies']);
                    }}
                  >
                    <span className='truncate'>Request bodies</span>
                    <Icon
                      icon={expandedKeys.includes('requestBodies') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
                  </Button>
                </div>
                {expandedKeys.includes('requestBodies') && (
                  <ListBox
                    items={Object.entries(requestBodies).map(
                      ([path, item]) => ({
                        ...item,
                        id: path,
                        path,
                      })
                    )}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`components.requestBodies.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Responses */}
            {responses && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('responses')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'responses')
                          )
                        : setExpandedKeys([...expandedKeys, 'responses']);
                    }}
                  >
                    <span className='truncate'>
                      Responses
                    </span>
                    <Icon
                      icon={expandedKeys.includes('responses') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
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
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`components.responses.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Parameters */}
            {parameters && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('parameters')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'parameters')
                          )
                        : setExpandedKeys([...expandedKeys, 'parameters']);
                    }}
                  >
                    <span className='truncate'>
                      Parameters
                    </span>
                    <Icon
                      icon={expandedKeys.includes('parameters') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
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
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`components.parameters.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Headers */}
            {headers && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('headers')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'headers')
                          )
                        : setExpandedKeys([...expandedKeys, 'headers']);
                    }}
                  >
                    <span className='truncate'>
                      Headers
                    </span>
                    <Icon
                      icon={expandedKeys.includes('headers') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
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
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`components.headers.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Schemas */}
            {schemas && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('schemas')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'schemas')
                          )
                        : setExpandedKeys([...expandedKeys, 'schemas']);
                    }}
                  >
                    <span className='truncate'>
                      Schemas
                    </span>
                    <Icon
                      icon={expandedKeys.includes('schemas') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
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
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`components.schemas.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
            {/* Security */}
            {securitySchemes && (
              <div className='divide-y divide-solid divide-[--hl-md]'>
                <div>
                  <Button
                    className="text-[--hl] text-sm uppercase w-full select-none p-[--padding-sm] hover:bg-[--hl-sm] focus:bg-[--hl-sm] flex gap-2 justify-between items-center"
                    onPress={() => {
                      expandedKeys.includes('security')
                        ? setExpandedKeys(
                            expandedKeys.filter(key => key !== 'security')
                          )
                        : setExpandedKeys([...expandedKeys, 'security']);
                    }}
                  >
                    <span className='truncate'>
                      Security
                    </span>
                    <Icon
                      icon={expandedKeys.includes('security') ? 'minus' : 'plus'}
                      className='text-xs'
                    />
                  </Button>
                </div>
                {expandedKeys.includes('security') && (
                  <ListBox
                    items={Object.entries(securitySchemes).map(
                      ([path, item]) => ({
                        ...item,
                        id: path,
                        path,
                      })
                    )}
                    onAction={key => navigateToPath(key.toString())}
                  >
                    {item => (
                      <Item
                        className="flex select-none outline-none relative hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        id={`components.securitySchemes.${item.path}`}
                      >
                        <span className="truncate">{item.path}</span>
                      </Item>
                    )}
                  </ListBox>
                )}
              </div>
            )}
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
        </div>
      }
      renderPaneTwo={isSpecPaneOpen && <SwaggerUIDiv text={apiSpec.contents} />}
      renderPaneOne={
        <div className="flex flex-col h-full w-full overflow-hidden divide-y divide-solid divide-[--hl-md]">
          <div className="relative overflow-hidden flex-shrink-0 flex flex-1 basis-1/2">
            <CodeEditor
              id="spec-editor"
              key={uniquenessKey}
              showPrettifyButton
              ref={editor}
              lintOptions={{ delay: 1000 }}
              mode="openapi"
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
                    }
                  );
                }}
              />
            )}
          </div>
          <div className="flex flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden">
            <div className="flex gap-2 items-center p-[--padding-sm]">
              <TooltipTrigger>
                <Button className="flex items-center gap-2 cursor-pointer select-none">
                  <Icon
                    icon={
                      rulesetPath ? 'file-circle-check' : 'file-circle-xmark'
                    }
                  />
                  Ruleset
                </Button>
                <Tooltip
                  placement="top end"
                  offset={8}
                  className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
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
                          To use a custom ruleset add a{' '}
                          <code className="p-0">.spectral.yaml</code> file to
                          the root of your git repository
                        </p>
                      </Fragment>
                    )}
                  </div>
                </Tooltip>
              </TooltipTrigger>
              {lintErrors.length > 0 && (
                <div className="flex gap-2 items-center select-none">
                  <Icon icon="circle-xmark" className="text-[--color-danger]" />
                  {lintErrors.length}
                </div>
              )}
              {lintWarnings.length > 0 && (
                <div className="flex gap-2 items-center select-none">
                  <Icon
                    icon="triangle-exclamation"
                    className="text-[--color-warning]"
                  />
                  {lintWarnings.length}
                </div>
              )}
              {lintMessages.length === 0 && apiSpec.contents && (
                <div className="flex gap-2 items-center select-none">
                  <Icon
                    icon="check-square"
                    className="text-[--color-success]"
                  />
                  No lint problems
                </div>
              )}
              <span className="flex-1" />
              {lintMessages.length > 0 && (
                <Button aria-label='Toggle lint panel' onPress={() => setIsLintPaneOpen(!isLintPaneOpen)}>
                  <Icon icon={isLintPaneOpen ? 'chevron-down' : 'chevron-up'} />
                </Button>
              )}
            </div>
            {isLintPaneOpen && (
              <ListBox
                className="overflow-y-auto flex-1 select-none"
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
                  <Item className="even:bg-[--hl-xs] p-[--padding-sm] focus-within:bg-[--hl-md] data-[focused]:bg-[--hl-md] outline-none flex items-center gap-2 text-xs transition-colors">
                    <Icon
                      className={
                        item.type === 'error'
                          ? 'text-[--color-danger]'
                          : 'text-[--color-warning]'
                      }
                      icon={
                        item.type === 'error'
                          ? 'circle-xmark'
                          : 'triangle-exclamation'
                      }
                    />
                    <span className="truncate">{item.message}</span>
                    <span className="flex-shrink-0 text-[--hl-lg]">
                      [Ln {item.line}]
                    </span>
                  </Item>
                )}
              </ListBox>
            )}
          </div>
        </div>
      }
    />
  );
};

export default Design;
