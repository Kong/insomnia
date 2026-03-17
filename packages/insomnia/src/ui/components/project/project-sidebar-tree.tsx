import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { CSSProperties, DragEvent, HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
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
  projectRowPaddingLeft: '0.5rem',
  workspaceRowPaddingLeft: '1.5rem',
  caretCenterOffset: '0.625rem',
} as const;

const MENU_CLASS =
  'min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden';
const MENU_ITEM_CLASS =
  'flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden';
const ROW_BASE_CLASS = 'group relative flex w-full min-w-0 items-center gap-1 rounded-xs py-1 pr-2';
const CARET_BUTTON_CLASS =
  'flex h-5 w-5 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)';
const ACTION_BUTTON_CLASS =
  'pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-focus:pointer-events-auto group-focus:opacity-100 hover:bg-(--hl-xs) focus:pointer-events-auto focus:opacity-100 data-pressed:pointer-events-auto data-pressed:opacity-100';
const LABEL_BUTTON_BASE_CLASS =
  'flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left text-md transition-colors';
const getRowClass = (active: boolean, dropInside: boolean, extra = '') =>
  `${ROW_BASE_CLASS} ${dropInside ? 'bg-(--hl-sm)' : active ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)'} ${extra}`.trim();

const getLabelClass = (active: boolean, extra = '') =>
  `${LABEL_BUTTON_BASE_CLASS} ${active ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'} ${extra}`.trim();

type TreeNodeType = 'request-group' | 'request';
export type ProjectSidebarTreeDragType = 'project' | 'workspace' | 'request-group' | 'request';
export type ProjectSidebarTreeDropPosition = 'before' | 'after' | 'inside';

export interface ProjectSidebarTreeNode {
  _id: string;
  parentId: string;
  name: string;
  nodeType: TreeNodeType;
  requestMethod?: string;
  metaSortKey?: number;
  doc: any;
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

export interface ProjectSidebarTreeDragEntity {
  type: ProjectSidebarTreeDragType;
  id: string;
  name: string;
  projectId: string;
  workspaceId?: string;
  workspaceScope?: string;
  ancestorIds?: string[];
}

export interface ProjectSidebarTreeDropPayload {
  source: ProjectSidebarTreeDragEntity;
  target: ProjectSidebarTreeDragEntity;
  position: ProjectSidebarTreeDropPosition;
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
  workspaceOrderByProjectId?: Record<string, string[]>;
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
  onValidDrop: (payload: ProjectSidebarTreeDropPayload) => void;
  onInvalidDrop: (payload: ProjectSidebarTreeDropPayload & { reason: string }) => void;
}

interface DropTarget {
  target: ProjectSidebarTreeDragEntity;
  position: ProjectSidebarTreeDropPosition;
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

function compareCollectionNodeOrder(a: ProjectSidebarTreeNode, b: ProjectSidebarTreeNode) {
  if (typeof a.metaSortKey === 'number' && typeof b.metaSortKey === 'number') {
    return a.metaSortKey - b.metaSortKey;
  }

  if (typeof a.metaSortKey === 'number') {
    return -1;
  }

  if (typeof b.metaSortKey === 'number') {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

function getDropPosition(
  event: DragEvent,
  allowInside: boolean,
): ProjectSidebarTreeDropPosition {
  if (!allowInside) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const y = event.clientY - rect.top;

  if (y < rect.height * 0.25) {
    return 'before';
  }

  if (y > rect.height * 0.75) {
    return 'after';
  }

  return 'inside';
}

function validateDrop(
  source: ProjectSidebarTreeDragEntity,
  target: ProjectSidebarTreeDragEntity,
  position: ProjectSidebarTreeDropPosition,
): { valid: boolean; reason?: string } {
  if (source.id === target.id && source.type === target.type) {
    return { valid: false, reason: 'Cannot move an item onto itself.' };
  }

  if (source.type === 'project') {
    if (target.type !== 'project' || position === 'inside') {
      return { valid: false, reason: 'Projects can only be reordered with other projects.' };
    }
    return { valid: true };
  }

  if (source.type === 'workspace') {
    if (target.type === 'project' && position === 'inside') {
      return { valid: true };
    }

    if (target.type === 'workspace' && position !== 'inside') {
      return { valid: true };
    }

    return { valid: false, reason: 'Workspaces can only be moved to a project or reordered with another workspace.' };
  }

  if (source.type === 'request' || source.type === 'request-group') {
    const targetIsCollectionRoot =
      target.type === 'workspace' && target.workspaceScope === 'collection' && position === 'inside';

    const targetIsFolder = target.type === 'request-group';
    const targetIsRequest = target.type === 'request';

    if (!targetIsCollectionRoot && !targetIsFolder && !targetIsRequest) {
      return { valid: false, reason: 'Requests and folders can only be moved inside collections.' };
    }

    if (targetIsRequest && position === 'inside') {
      return { valid: false, reason: 'Cannot drop inside a request.' };
    }

    if (source.type === 'request-group' && position === 'inside' && target.type === 'request-group') {
      if (target.ancestorIds?.includes(source.id)) {
        return { valid: false, reason: 'Cannot move a folder into one of its descendants.' };
      }
    }

    return { valid: true };
  }

  return { valid: false, reason: 'This drag operation is not supported.' };
}

export function ProjectSidebarTree<
  TProject extends ProjectSidebarTreeProject,
  TFile extends ProjectSidebarWorkspaceFile,
>({
  projects,
  projectFilesByProjectId,
  collectionTreeByWorkspaceId,
  workspaceScopeOrder,
  workspaceOrderByProjectId,
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
  onValidDrop,
  onInvalidDrop,
}: ProjectSidebarTreeProps<TProject, TFile>) {
  const [draggedEntity, setDraggedEntity] = useState<ProjectSidebarTreeDragEntity | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const handleDrop = (
    source: ProjectSidebarTreeDragEntity,
    target: ProjectSidebarTreeDragEntity,
    position: ProjectSidebarTreeDropPosition,
  ) => {
    const validation = validateDrop(source, target, position);

    if (validation.valid) {
      onValidDrop({ source, target, position });
    } else {
      onInvalidDrop({ source, target, position, reason: validation.reason || 'Invalid drop target.' });
    }

    setDropTarget(null);
    setDraggedEntity(null);
  };

  const bindRowDnD = (
    entity: ProjectSidebarTreeDragEntity,
    allowInside: boolean,
  ): HTMLAttributes<HTMLDivElement> => {
    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
      if (!draggedEntity) {
        return;
      }
      if (draggedEntity.type === 'project' && entity.type !== 'project') {
        return;
      }

      event.preventDefault();
      const position = getDropPosition(event, allowInside);
      const isExpandedProjectTarget = entity.type === 'project' && expandedProjectIds.includes(entity.id);

      if (draggedEntity.type === 'project' && isExpandedProjectTarget && position !== 'before') {
        setDropTarget(null);
        return;
      }

      setDropTarget({ target: entity, position });
    };

    const handleDropEvent = (event: DragEvent<HTMLDivElement>) => {
      if (!draggedEntity) {
        return;
      }
      if (draggedEntity.type === 'project' && entity.type !== 'project') {
        return;
      }

      event.preventDefault();
      const position = getDropPosition(event, allowInside);
      const isExpandedProjectTarget = entity.type === 'project' && expandedProjectIds.includes(entity.id);

      if (draggedEntity.type === 'project' && isExpandedProjectTarget && position !== 'before') {
        return;
      }

      handleDrop(draggedEntity, entity, position);
    };

    return {
    draggable: true,
    onDragStart: event => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', entity.id);
      setDraggedEntity(entity);
    },
    onDragOver: handleDragOver,
    onDrop: handleDropEvent,
    onDragOverCapture: handleDragOver,
    onDropCapture: handleDropEvent,
    onDragEnd: () => {
      setDropTarget(null);
      setDraggedEntity(null);
    },
  };
  };

  const bindProjectTailDropZone = (
    entity: ProjectSidebarTreeDragEntity,
  ): HTMLAttributes<HTMLDivElement> => ({
    onDragOver: event => {
      if (!draggedEntity || draggedEntity.type !== 'project') {
        return;
      }

      event.preventDefault();
      setDropTarget({ target: entity, position: 'after' });
    },
    onDrop: event => {
      if (!draggedEntity || draggedEntity.type !== 'project') {
        return;
      }

      event.preventDefault();
      handleDrop(draggedEntity, entity, 'after');
    },
  });

  const getDropState = (entity: ProjectSidebarTreeDragEntity) => {
    if (!dropTarget || dropTarget.target.id !== entity.id || dropTarget.target.type !== entity.type) {
      return {
        isDropBefore: false,
        isDropAfter: false,
        isDropInside: false,
        isValid: true,
      };
    }

    const validation = draggedEntity ? validateDrop(draggedEntity, dropTarget.target, dropTarget.position) : { valid: true };

    return {
      isDropBefore: dropTarget.position === 'before',
      isDropAfter: dropTarget.position === 'after',
      isDropInside: dropTarget.position === 'inside',
      isValid: validation.valid,
    };
  };

  const renderDropLine = (show: boolean, top: boolean, isValid: boolean) =>
    show ? (
      <span
        className={`pointer-events-none absolute ${top ? 'top-0' : 'bottom-0'} left-6 right-2 h-[2px] rounded-full ${isValid ? 'bg-(--color-surprise)' : 'bg-(--color-danger)'}`}
      />
    ) : null;

  return (
    <>
      {projects.map(project => {
        const isProjectExpanded = expandedProjectIds.includes(project._id);
        const isActiveProject = project._id === activeProjectId;
        const files = projectFilesByProjectId[project._id] || [];
        const projectEntity: ProjectSidebarTreeDragEntity = {
          type: 'project',
          id: project._id,
          name: project.name,
          projectId: project._id,
        };
        const projectDropState = getDropState(projectEntity);

        return (
          <div key={project._id} className="flex flex-col">
            <div
              {...bindRowDnD(projectEntity, true)}
              className={getRowClass(isActiveProject, projectDropState.isDropInside, 'px-2 gap-0')}
            >
              {renderDropLine(projectDropState.isDropBefore, true, projectDropState.isValid)}
              {renderDropLine(!isProjectExpanded && projectDropState.isDropAfter, false, projectDropState.isValid)}
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
                      const workspaceOrder = workspaceOrderByProjectId?.[project._id] || [];
                      const rankA = workspaceOrder.indexOf(a.id);
                      const rankB = workspaceOrder.indexOf(b.id);

                      if (rankA !== -1 || rankB !== -1) {
                        if (rankA === -1) {
                          return 1;
                        }

                        if (rankB === -1) {
                          return -1;
                        }

                        return rankA - rankB;
                      }

                      const scopeDiff = (workspaceScopeOrder[a.scope] || 99) - (workspaceScopeOrder[b.scope] || 99);
                      return scopeDiff !== 0 ? scopeDiff : a.name.localeCompare(b.name);
                    })
                    .map(file => {
                      const workspaceEntity: ProjectSidebarTreeDragEntity = {
                        type: 'workspace',
                        id: file.id,
                        name: file.name,
                        projectId: project._id,
                        workspaceId: file.id,
                        workspaceScope: file.scope,
                      };
                      const workspaceDropState = getDropState(workspaceEntity);

                      if (file.scope !== 'collection') {
                        const isWorkspaceActive = activeWorkspaceId === file.workspace?._id;

                        return (
                          <div key={`${project._id}:${file.id}`} className="min-w-0">
                            <div
                              {...bindRowDnD(workspaceEntity, false)}
                              className={getRowClass(isWorkspaceActive, workspaceDropState.isDropInside, 'pl-6')}
                            >
                              {renderDropLine(workspaceDropState.isDropBefore, true, workspaceDropState.isValid)}
                              {renderDropLine(workspaceDropState.isDropAfter, false, workspaceDropState.isValid)}
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
                      const rootNodes = collectionTreeNodes
                        .filter(node => node.parentId === file.id)
                        .sort(compareCollectionNodeOrder);
                      const isCollectionActive =
                        activeWorkspaceId === file.workspace?._id && !activeRequestId && !activeRequestGroupId;

                      const renderTreeNodes = (parentId: string, depth: number, ancestorIds: string[] = []): ReactNode[] =>
                        collectionTreeNodes
                          .filter(node => node.parentId === parentId)
                          .sort(compareCollectionNodeOrder)
                          .map(node => {
                            const requestGroupKey = `${project._id}:${file.id}:${node._id}`;
                            const isRequestGroupExpanded = expandedRequestGroupKeys.includes(requestGroupKey);
                            const hasChildren = collectionTreeNodes.some(childNode => childNode.parentId === node._id);
                            const nodeEntity: ProjectSidebarTreeDragEntity = {
                              type: node.nodeType,
                              id: node._id,
                              name: node.name,
                              projectId: project._id,
                              workspaceId: file.id,
                              workspaceScope: file.scope,
                              ancestorIds,
                            };
                            const nodeDropState = getDropState(nodeEntity);

                            if (node.nodeType === 'request-group') {
                              return (
                                <div key={requestGroupKey} className="flex flex-col">
                                  <div
                                    {...bindRowDnD(nodeEntity, true)}
                                    className={getRowClass(
                                      activeRequestGroupId === node._id,
                                      nodeDropState.isDropInside,
                                    )}
                                    style={{ paddingLeft: `${depth}px` }}
                                  >
                                    {renderDropLine(nodeDropState.isDropBefore, true, nodeDropState.isValid)}
                                    {renderDropLine(nodeDropState.isDropAfter, false, nodeDropState.isValid)}
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
                                          [...ancestorIds, node._id],
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
                              <div
                                key={requestGroupKey}
                                {...bindRowDnD(nodeEntity, false)}
                                className={getRowClass(activeRequestId === node._id, nodeDropState.isDropInside)}
                              >
                                {renderDropLine(nodeDropState.isDropBefore, true, nodeDropState.isValid)}
                                {renderDropLine(nodeDropState.isDropAfter, false, nodeDropState.isValid)}
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
                          <div
                            {...bindRowDnD(workspaceEntity, true)}
                            className={getRowClass(isCollectionActive, workspaceDropState.isDropInside, 'pl-6')}
                          >
                            {renderDropLine(workspaceDropState.isDropBefore, true, workspaceDropState.isValid)}
                            {renderDropLine(workspaceDropState.isDropAfter, false, workspaceDropState.isValid)}
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
                  <div
                    {...bindProjectTailDropZone(projectEntity)}
                    className="relative h-4"
                    aria-hidden
                  >
                    {renderDropLine(projectDropState.isDropAfter, false, projectDropState.isValid)}
                  </div>
                </div>
              </TreeBranchGuide>
            )}
          </div>
        );
      })}
    </>
  );
}
