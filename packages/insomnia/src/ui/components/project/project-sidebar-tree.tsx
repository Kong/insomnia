import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { CSSProperties, ReactNode } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import type { Workspace } from '~/models/workspace';
import { Icon } from '~/ui/components/icon';

export const PROJECT_SIDEBAR_TREE_TOKENS = {
  folderChildDepthOffset: 16,
  requestLabelDepthOffset: 18,
  emptyLabelDepthOffset: 22,
  collectionRootDepth: 34,
} as const;

const PROJECT_SIDEBAR_TREE_STYLE_TOKENS = {
  projectRowPaddingLeft: '0.5rem', // px-2
  workspaceRowPaddingLeft: '1.5rem', // pl-6
  caretCenterOffset: '0.625rem', // h-5 / 2
} as const;

const MENU_CLASS =
  'min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden';
const MENU_ITEM_CLASS =
  'flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden';
const ROW_BASE_CLASS = 'group flex w-full min-w-0 items-center gap-1 rounded-xs py-1 pr-2';
const CARET_BUTTON_CLASS =
  'flex h-5 w-5 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)';
const ACTION_BUTTON_CLASS =
  'pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-focus:pointer-events-auto group-focus:opacity-100 hover:bg-(--hl-xs) focus:pointer-events-auto focus:opacity-100 data-pressed:pointer-events-auto data-pressed:opacity-100';
const LABEL_BUTTON_BASE_CLASS =
  'flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left text-md transition-colors';

const getRowClass = (active: boolean, extra = '') =>
  `${ROW_BASE_CLASS} ${active ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)'} ${extra}`.trim();

const getLabelClass = (active: boolean, extra = '') =>
  `${LABEL_BUTTON_BASE_CLASS} ${active ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'} ${extra}`.trim();

type TreeNodeType = 'request-group' | 'request';

export interface ProjectSidebarTreeNode {
  _id: string;
  parentId: string;
  name: string;
  nodeType: TreeNodeType;
  requestMethod?: string;
  doc: unknown;
}

export interface ProjectSidebarWorkspaceFile {
  id: string;
  name: string;
  scope: string;
  workspace?: Workspace;
}

export interface ProjectSidebarTreeProject {
  _id: string;
  name: string;
}

export interface ProjectSidebarTreeAction {
  id: string;
  label: string;
  isDanger?: boolean;
  onAction: () => void;
}

interface ProjectSidebarTreeProps<
  TProject extends ProjectSidebarTreeProject,
  TFile extends ProjectSidebarWorkspaceFile,
> {
  projects: TProject[];
  projectFilesByProjectId: Record<string, TFile[]>;
  collectionTreeByWorkspaceId: Record<string, ProjectSidebarTreeNode[]>;
  workspaceScopeOrder: Record<string, number>;
  workspaceScopeIcon: Record<string, IconProp>;
  expandedProjectIds: string[];
  expandedCollectionKeys: string[];
  expandedRequestGroupKeys: string[];
  activeProjectId?: string;
  activeWorkspaceId?: string;
  activeRequestId?: string;
  activeRequestGroupId?: string;
  onToggleProjectExpanded: (id: string) => void;
  onToggleCollectionExpanded: (key: string) => void;
  onToggleRequestGroupExpanded: (key: string) => void;
  onOpenProject: (project: TProject) => void;
  onOpenWorkspace: (project: TProject, file: TFile, withTab?: boolean) => void;
  onOpenCollectionNode: (project: TProject, file: TFile, node: ProjectSidebarTreeNode, withTab?: boolean) => void;
  isPrimaryClickModifier: (
    event: Parameters<NonNullable<React.ComponentProps<typeof Button>['onPress']>>[0],
  ) => boolean;
  getProjectIcon: (project: TProject) => IconProp;
  renderProjectMeta?: (project: TProject) => ReactNode;
  getRequestMethodBadgeClass: (method: string) => string;
  getRequestMethodLabel: (method: string) => string;
  getProjectActions: (project: TProject) => ProjectSidebarTreeAction[];
  getWorkspaceActions: (project: TProject, file: TFile) => ProjectSidebarTreeAction[];
  getCollectionActions: (project: TProject, file: TFile) => ProjectSidebarTreeAction[];
  getFolderActions: (project: TProject, file: TFile, node: ProjectSidebarTreeNode) => ProjectSidebarTreeAction[];
  getRequestActions: (project: TProject, file: TFile, node: ProjectSidebarTreeNode) => ProjectSidebarTreeAction[];
}

function TreeActionMenu({ label, actions }: { label: string; actions: ProjectSidebarTreeAction[] }) {
  if (!actions.length) {
    return null;
  }

  return (
    <MenuTrigger>
      <Button aria-label={label} className={ACTION_BUTTON_CLASS}>
        <Icon icon="ellipsis-h" />
      </Button>
      <Popover className="flex min-w-max flex-col overflow-y-hidden">
        <Menu aria-label={label} className={MENU_CLASS}>
          {actions.map(action => (
            <MenuItem
              key={action.id}
              id={action.id}
              onAction={action.onAction}
              className={`${MENU_ITEM_CLASS} ${action.isDanger ? 'text-(--color-danger)' : ''}`}
            >
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function TreeBranchGuide({ left, children }: { left: string; children: ReactNode }) {
  return (
    <div className="project-sidebar-tree-branch" style={{ '--project-tree-guide-left': left } as CSSProperties}>
      <div className="project-sidebar-tree-guide-line" />
      {children}
    </div>
  );
}

export function ProjectSidebarTree<
  TProject extends ProjectSidebarTreeProject,
  TFile extends ProjectSidebarWorkspaceFile,
>({
  projects,
  projectFilesByProjectId,
  collectionTreeByWorkspaceId,
  workspaceScopeOrder,
  workspaceScopeIcon,
  expandedProjectIds,
  expandedCollectionKeys,
  expandedRequestGroupKeys,
  activeProjectId,
  activeWorkspaceId,
  activeRequestId,
  activeRequestGroupId,
  onToggleProjectExpanded,
  onToggleCollectionExpanded,
  onToggleRequestGroupExpanded,
  onOpenProject,
  onOpenWorkspace,
  onOpenCollectionNode,
  isPrimaryClickModifier,
  getProjectIcon,
  renderProjectMeta,
  getRequestMethodBadgeClass,
  getRequestMethodLabel,
  getProjectActions,
  getWorkspaceActions,
  getCollectionActions,
  getFolderActions,
  getRequestActions,
}: ProjectSidebarTreeProps<TProject, TFile>) {
  return (
    <>
      {projects.map(project => {
        const isProjectExpanded = expandedProjectIds.includes(project._id);
        const isActiveProject = project._id === activeProjectId;
        const files = projectFilesByProjectId[project._id] || [];

        return (
          <div key={project._id} className="flex flex-col">
            <div className={getRowClass(isActiveProject, 'px-2')}>
              <Button
                aria-label={`${isProjectExpanded ? 'Collapse' : 'Expand'} ${project.name}`}
                onPress={() => onToggleProjectExpanded(project._id)}
                className={CARET_BUTTON_CLASS}
              >
                <Icon icon={isProjectExpanded ? 'chevron-down' : 'chevron-right'} className="h-3 w-3" />
              </Button>
              <Button
                aria-label={`Open project ${project.name}`}
                onPress={() => onOpenProject(project)}
                className={getLabelClass(isActiveProject)}
              >
                <Icon icon={getProjectIcon(project)} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {renderProjectMeta?.(project)}
              </Button>
              <TreeActionMenu label={`Actions for project ${project.name}`} actions={getProjectActions(project)} />
            </div>
            {isProjectExpanded && (
              <TreeBranchGuide
                left={`calc(${PROJECT_SIDEBAR_TREE_STYLE_TOKENS.projectRowPaddingLeft} + ${PROJECT_SIDEBAR_TREE_STYLE_TOKENS.caretCenterOffset})`}
              >
                <div className="mb-1 flex flex-col">
                  {files
                    .slice()
                    .sort((a, b) => {
                      const scopeDiff = (workspaceScopeOrder[a.scope] || 99) - (workspaceScopeOrder[b.scope] || 99);
                      return scopeDiff !== 0 ? scopeDiff : a.name.localeCompare(b.name);
                    })
                    .map(file => {
                      if (file.scope !== 'collection') {
                        const isWorkspaceActive = activeWorkspaceId === file.workspace?._id;

                        return (
                          <div key={`${project._id}:${file.id}`} className="min-w-0">
                            <div className={getRowClass(isWorkspaceActive, 'pl-6')}>
                              <span className="h-5 w-5 shrink-0" />
                              <Button
                                aria-label={`Open ${file.name}`}
                                onPress={e => onOpenWorkspace(project, file, isPrimaryClickModifier(e))}
                                className={getLabelClass(isWorkspaceActive)}
                              >
                                <Icon icon={workspaceScopeIcon[file.scope]} className="w-3.5" />
                                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              </Button>
                              <TreeActionMenu
                                label={`Actions for ${file.name}`}
                                actions={getWorkspaceActions(project, file)}
                              />
                            </div>
                          </div>
                        );
                      }

                      const collectionKey = `${project._id}:${file.id}`;
                      const isCollectionExpanded = expandedCollectionKeys.includes(collectionKey);
                      const collectionTreeNodes = collectionTreeByWorkspaceId[file.id] || [];
                      const rootNodes = collectionTreeNodes.filter(node => node.parentId === file.id);
                      const isCollectionActive =
                        activeWorkspaceId === file.workspace?._id && !activeRequestId && !activeRequestGroupId;

                      const renderTreeNodes = (parentId: string, depth: number): ReactNode[] =>
                        collectionTreeNodes
                          .filter(node => node.parentId === parentId)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(node => {
                            const requestGroupKey = `${project._id}:${file.id}:${node._id}`;
                            const isRequestGroupExpanded = expandedRequestGroupKeys.includes(requestGroupKey);
                            const hasChildren = collectionTreeNodes.some(childNode => childNode.parentId === node._id);

                            if (node.nodeType === 'request-group') {
                              return (
                                <div key={requestGroupKey} className="flex flex-col">
                                  <div
                                    className={getRowClass(activeRequestGroupId === node._id)}
                                    style={{ paddingLeft: `${depth}px` }}
                                  >
                                    <Button
                                      aria-label={`${isRequestGroupExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
                                      onPress={() => onToggleRequestGroupExpanded(requestGroupKey)}
                                      className={CARET_BUTTON_CLASS}
                                    >
                                      <Icon
                                        icon={isRequestGroupExpanded ? 'chevron-down' : 'chevron-right'}
                                        className="h-3 w-3"
                                      />
                                    </Button>
                                    <Button
                                      aria-label={`Open folder ${node.name}`}
                                      onPress={e =>
                                        onOpenCollectionNode(project, file, node, isPrimaryClickModifier(e))
                                      }
                                      className={getLabelClass(activeRequestGroupId === node._id)}
                                    >
                                      <Icon icon="folder" className="w-3" />
                                      <span className="min-w-0 flex-1 truncate">{node.name}</span>
                                    </Button>
                                    <TreeActionMenu
                                      label={`Actions for folder ${node.name}`}
                                      actions={getFolderActions(project, file, node)}
                                    />
                                  </div>
                                  {isRequestGroupExpanded &&
                                    (hasChildren ? (
                                      <TreeBranchGuide
                                        left={`calc(${depth}px + ${PROJECT_SIDEBAR_TREE_STYLE_TOKENS.caretCenterOffset})`}
                                      >
                                        {renderTreeNodes(
                                          node._id,
                                          depth + PROJECT_SIDEBAR_TREE_TOKENS.folderChildDepthOffset,
                                        )}
                                      </TreeBranchGuide>
                                    ) : (
                                      <div
                                        className="py-1 pr-2 text-xs text-(--hl)"
                                        style={{
                                          paddingLeft: `${depth + PROJECT_SIDEBAR_TREE_TOKENS.emptyLabelDepthOffset}px`,
                                        }}
                                      >
                                        Empty folder
                                      </div>
                                    ))}
                                </div>
                              );
                            }

                            return (
                              <div key={requestGroupKey} className={getRowClass(activeRequestId === node._id)}>
                                <Button
                                  aria-label={`Open request ${node.name}`}
                                  onPress={e => onOpenCollectionNode(project, file, node, isPrimaryClickModifier(e))}
                                  className={getLabelClass(activeRequestId === node._id)}
                                  style={{
                                    paddingLeft: `${depth + PROJECT_SIDEBAR_TREE_TOKENS.requestLabelDepthOffset}px`,
                                  }}
                                >
                                  {node.requestMethod && (
                                    <span
                                      className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${getRequestMethodBadgeClass(node.requestMethod)}`}
                                    >
                                      {getRequestMethodLabel(node.requestMethod)}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1 truncate">{node.name}</span>
                                </Button>
                                <TreeActionMenu
                                  label={`Actions for request ${node.name}`}
                                  actions={getRequestActions(project, file, node)}
                                />
                              </div>
                            );
                          });

                      return (
                        <div key={collectionKey} className="flex flex-col">
                          <div className={getRowClass(isCollectionActive, 'pl-6')}>
                            <Button
                              aria-label={`${isCollectionExpanded ? 'Collapse' : 'Expand'} ${file.name}`}
                              onPress={() => onToggleCollectionExpanded(collectionKey)}
                              className={CARET_BUTTON_CLASS}
                            >
                              <Icon
                                icon={isCollectionExpanded ? 'chevron-down' : 'chevron-right'}
                                className="h-3 w-3"
                              />
                            </Button>
                            <Button
                              aria-label={`Open ${file.name}`}
                              onPress={e => onOpenWorkspace(project, file, isPrimaryClickModifier(e))}
                              className={getLabelClass(isCollectionActive)}
                            >
                              <Icon icon={workspaceScopeIcon[file.scope]} className="w-3.5" />
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                            </Button>
                            <TreeActionMenu
                              label={`Actions for ${file.name}`}
                              actions={getCollectionActions(project, file)}
                            />
                          </div>
                          {isCollectionExpanded &&
                            (rootNodes.length ? (
                              <TreeBranchGuide
                                left={`calc(${PROJECT_SIDEBAR_TREE_STYLE_TOKENS.workspaceRowPaddingLeft} + ${PROJECT_SIDEBAR_TREE_STYLE_TOKENS.caretCenterOffset})`}
                              >
                                {renderTreeNodes(file.id, PROJECT_SIDEBAR_TREE_TOKENS.collectionRootDepth)}
                              </TreeBranchGuide>
                            ) : (
                              <div className="py-1 pr-2 pl-12 text-xs text-(--hl)">Empty collection</div>
                            ))}
                        </div>
                      );
                    })}
                </div>
              </TreeBranchGuide>
            )}
          </div>
        );
      })}
    </>
  );
}
