import type { Virtualizer } from '@tanstack/react-virtual';
import { models, type WorkspaceScope } from 'insomnia-data';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { DragAndDropHooks, DropTarget, ItemDropTarget } from 'react-aria-components';
import { DropIndicator, useDragAndDrop } from 'react-aria-components';

import { useDebugReorderActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';
import { Icon } from '~/ui/components/icon';

import type { CollectionChildFlatItem, EmptyNodeFlatItem, FlatItem } from './types';

const allowDragKinds: FlatItem['kind'][] = ['workspace', 'collectionChild'];
const emptyNodeKinds: FlatItem['kind'][] = ['emptyFolder', 'emptyProject', 'emptyCollection'];
const allowDropKinds: FlatItem['kind'][] = ['workspace', 'collectionChild', 'project', ...emptyNodeKinds];
type AllowDragItem = Extract<FlatItem, { kind: 'workspace' | 'collectionChild' }>;
type AllowDropTarget = Extract<
  FlatItem,
  { kind: 'workspace' | 'collectionChild' | 'project' | 'emptyFolder' | 'emptyProject' | 'emptyCollection' }
>;
// Whitelist workspace scopes that are allowed to be moved across projects.
const allowCrossProjectDropWorkspaceScope: WorkspaceScope[] = [models.workspace.WorkspaceScopeKeys.collection];

function isAllowDragItem(item: FlatItem): item is AllowDragItem {
  return allowDragKinds.includes(item.kind);
}

function isAllowDropTarget(item: FlatItem): item is AllowDropTarget {
  return allowDropKinds.includes(item.kind);
}

function isEmptyNode(item: FlatItem): item is EmptyNodeFlatItem {
  return emptyNodeKinds.includes(item.kind);
}

export function getIndentLevel(item: FlatItem | null): number {
  if (!item || item.kind === 'pinnedRequest') {
    return 0;
  }
  return 'level' in item && typeof item.level === 'number' ? item.level : 0;
}

type HasVisibleChildren = (folderId: string) => boolean;
type FlatItemById = (id: string) => FlatItem | null;
// Every visible row mapped to itself plus its previous and next visible rows.
type FlatItemsById = Map<string, readonly [FlatItem, FlatItem | undefined, FlatItem | undefined]>;
type DropPositionKind = ItemDropTarget['dropPosition'];

function isCollectionChild(item: FlatItem | null | undefined): item is CollectionChildFlatItem {
  return item?.kind === 'collectionChild';
}

function isFolderItem(item: FlatItem | null | undefined): item is CollectionChildFlatItem {
  return isCollectionChild(item) && models.requestGroup.isRequestGroup(item.doc);
}

// realTargetItem is the row the drop attaches to: the preceding row for a
// "before" drop, the target itself otherwise.
export interface BoundaryTargets {
  dropPosition: DropPositionKind;
  targetItem: FlatItem;
  realTargetItem?: FlatItem | null;
  nextItem?: FlatItem | null;
}

export interface DropContext {
  hasVisibleChildren: HasVisibleChildren;
  lookup: FlatItemById;
  flatItemsById: FlatItemsById;
  // Nesting level the cursor's x currently selects (see levelFromX).
  preferredLevel: number;
}

interface NormalizedBoundary {
  dropPosition: DropPositionKind;
  targetItem: FlatItem;
  redirected: boolean;
}

// Not 16: the app sets html font-size from the interface fontSize setting
// (13px default) in use-settings-side-effects.ts, so it has to be measured.
const FALLBACK_PX_PER_REM = 16;
function measurePxPerRem(): number {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : FALLBACK_PX_PER_REM;
}

// Mirrors the rows' paddingLeft (request-node.tsx). levelFromX and
// indentRemForLevel must stay exact inverses of each other.
const ROOT_INDENT_REM = 3;
const MIN_INDENT_REM = 1;

export function levelFromX(x: number, depthOffset: number, pxPerRem: number): number {
  return Math.round(x / pxPerRem) - ROOT_INDENT_REM + depthOffset;
}

function indentRemForLevel(level: number, depthOffset: number): number {
  return Math.max(level + ROOT_INDENT_REM - depthOffset, MIN_INDENT_REM);
}

// Deeper and shallower side of a multi-depth gap, or null for a same-level
// insert. Both raw forms of one gap map to the same pair.
function resolveGapSides(
  { dropPosition, targetItem, realTargetItem, nextItem }: BoundaryTargets,
): { deep: CollectionChildFlatItem; shallow: CollectionChildFlatItem } | null {
  const otherItem = dropPosition === 'before' ? realTargetItem : nextItem;
  if (!isCollectionChild(targetItem) || !isCollectionChild(otherItem)) {
    return null;
  }
  const targetLevel = getIndentLevel(targetItem);
  const otherLevel = getIndentLevel(otherItem);
  if (targetLevel === otherLevel) {
    return null;
  }
  // A folder's own trailing edge; the merge-inside branch handles it.
  if (dropPosition === 'after' && targetLevel < otherLevel) {
    return null;
  }
  return targetLevel > otherLevel
    ? { deep: targetItem, shallow: otherItem }
    : { deep: otherItem, shallow: targetItem };
}

// react-stately treats `after X` and `before nextKey(X)` as one insertion point
// (getOppositeTarget in useDroppableCollectionState). In a tree they must differ
// — beside a folder vs. inside it — so both raw forms are normalized here, and
// every caller resolves through this. Doing it in the delegate instead breaks
// rendering: react-aria only tests candidates tied to specific rows.
//
// A gap can span several depths; preferredLevel picks one by indexing the deeper
// row's `ancestors` (root-first, so index === level).
export function normalizeBoundaryTarget(
  boundary: BoundaryTargets,
  { hasVisibleChildren, preferredLevel, lookup }: DropContext,
): NormalizedBoundary {
  const { dropPosition, targetItem, realTargetItem } = boundary;
  // Same gap as "before" its first child: land inside only if the cursor asks
  // to go deeper than the folder itself.
  if (
    dropPosition === 'after' &&
    isFolderItem(targetItem) &&
    hasVisibleChildren(targetItem.doc._id) &&
    preferredLevel > getIndentLevel(targetItem)
  ) {
    return { dropPosition: 'on', targetItem, redirected: false };
  }
  // A "Folder is empty" placeholder stands in for the folder's interior, so the
  // gap above it is the folder's trailing edge. Rewriting also fixes ordering:
  // the placeholder form carries a first-child sort key.
  if (
    dropPosition === 'before' &&
    isEmptyNode(targetItem) &&
    isFolderItem(realTargetItem) &&
    preferredLevel <= getIndentLevel(realTargetItem)
  ) {
    return { dropPosition: 'after', targetItem: realTargetItem, redirected: true };
  }
  // The placeholder's lower edge: the gap after the folder's whole interior.
  // Not level-aware on purpose — the opposite raw form can't express "inside",
  // so offering it here would make the two forms disagree.
  if (dropPosition === 'after' && isEmptyNode(targetItem)) {
    const owningFolder = targetItem.requestGroup ? lookup(targetItem.requestGroup._id) : null;
    if (isFolderItem(owningFolder)) {
      return { dropPosition: 'after', targetItem: owningFolder, redirected: true };
    }
  }

  // Clamp the requested level to the range the gap spans, then walk the deeper
  // row's ancestor chain. Three raw forms share this one walk by design.
  const gap = resolveGapSides(boundary);
  if (gap) {
    const deepLevel = getIndentLevel(gap.deep);
    const level = Math.min(Math.max(preferredLevel, getIndentLevel(gap.shallow)), deepLevel);
    const ancestorId = level < deepLevel ? gap.deep.ancestors?.[level] : undefined;
    const ancestor = ancestorId ? lookup(ancestorId) : null;
    if (isCollectionChild(ancestor)) {
      return { dropPosition: 'after', targetItem: ancestor, redirected: ancestor !== targetItem };
    }
    // Deepest landing. If the deep row is the target the caller's form already
    // says so; otherwise re-anchor onto it.
    return gap.deep === targetItem
      ? { dropPosition, targetItem, redirected: false }
      : { dropPosition: 'after', targetItem: gap.deep, redirected: true };
  }

  return { dropPosition, targetItem, redirected: false };
}

// The dragged item's new parent, sent to the reorder route outright so there is
// one implementation of "where does this land".
function destinationParentIdFor(
  { targetItem, dropPosition }: NormalizedBoundary,
  { realTargetItem }: BoundaryTargets,
): string | null {
  // At the top of a collection the previous row is the workspace header itself.
  if (realTargetItem?.kind === 'workspace' && models.workspace.isCollection(realTargetItem.doc)) {
    return realTargetItem.doc._id;
  }

  if (dropPosition === 'on' && isFolderItem(targetItem)) {
    return targetItem.doc._id;
  }

  // Only the "inside" case reaches here; normalizeBoundaryTarget rewrites the
  // shallower one.
  if (isEmptyNode(targetItem) && isFolderItem(realTargetItem)) {
    return realTargetItem.doc._id;
  }

  if (isCollectionChild(targetItem) && 'parentId' in targetItem.doc) {
    return targetItem.doc.parentId;
  }

  return null;
}

// Folder a drop lands inside, or null at top level. Worth naming because the
// folder adjacent to a boundary is often not the destination.
function destinationFolderNameFor(normalized: NormalizedBoundary, parentItem: FlatItem | null): string | null {
  // Hovering a folder's own row without merging to 'on': naming it would read
  // as "into it" when the drop goes beside it. A redirect is unambiguous.
  if (normalized.dropPosition === 'after' && !normalized.redirected && isFolderItem(normalized.targetItem)) {
    return null;
  }
  return isFolderItem(parentItem) ? parentItem.doc.name || 'Untitled folder' : null;
}

export interface ResolvedDrop {
  normalized: NormalizedBoundary;
  parentId: string | null;
  // The destination as a row, when visible — canDrop needs its ancestry.
  parentItem: FlatItem | null;
  folderName: string | null;
  landingLevel: number;
}

// One normalization pass, shared by the indicator and the commit so they cannot
// disagree about where a drop lands.
export function resolveDrop(boundary: BoundaryTargets, ctx: DropContext): ResolvedDrop {
  const normalized = normalizeBoundaryTarget(boundary, ctx);
  const parentId = destinationParentIdFor(normalized, boundary);
  const parentItem = parentId ? (ctx.flatItemsById.get(parentId)?.[0] ?? null) : null;
  return {
    normalized,
    parentId,
    parentItem,
    folderName: destinationFolderNameFor(normalized, parentItem),
    landingLevel: getIndentLevel(normalized.targetItem),
  };
}

export function canDrop(
  dragItem: FlatItem,
  boundary: BoundaryTargets,
  // Level selection can redirect the landing far from the row the boundary sits
  // on, so containment below is tested against this, not the anchor row.
  destination: Pick<ResolvedDrop, 'parentId' | 'parentItem'>,
  expandedProjectAndWorkspaceIds?: string[],
) {
  const { dropPosition, targetItem: dropItem, realTargetItem: realDropItem, nextItem } = boundary;
  const { parentId: destinationParentId, parentItem: destinationParentItem } = destination;
  if (dropPosition === 'on') {
    // Dropping directly "on" a row means "move inside this folder" — only valid
    // when dragging a request/request group onto another folder.
    if (
      dragItem.doc._id === dropItem.doc._id ||
      dragItem.kind !== 'collectionChild' ||
      !isAllowDragItem(dragItem) ||
      !isFolderItem(dropItem)
    ) {
      return false;
    }
    // moving a folder into itself or one of its own descendants is not allowed
    return !(models.requestGroup.isRequestGroup(dragItem.doc) && dropItem.ancestors?.includes(dragItem.doc._id));
  }

  // The item following realDropItem in the list
  const itemAfterRealDrop = dropPosition === 'before' ? dropItem : nextItem;
  if (!realDropItem || !isAllowDropTarget(realDropItem)) {
    return false;
  }

  // Nothing may land inside itself, and no folder inside its own descendants.
  // Self-parenting is unrecoverable: roots come from `parentId === workspaceId`,
  // so the folder and its subtree would vanish from the sidebar.
  if (isCollectionChild(dragItem)) {
    if (destinationParentId === dragItem.doc._id) {
      return false;
    }
    if (
      models.requestGroup.isRequestGroup(dragItem.doc) &&
      isCollectionChild(destinationParentItem) &&
      destinationParentItem.ancestors?.includes(dragItem.doc._id)
    ) {
      return false;
    }
  }

  // Beside the dragged item is normally a no-op, but level selection can make it
  // a real move out of the parent — so only reject it if the parent is unchanged.
  const isBesideDragItem = dragItem.doc._id === dropItem.doc._id || dragItem.doc._id === realDropItem.doc._id;
  if (isBesideDragItem) {
    const changesParent =
      dragItem.kind === 'collectionChild' &&
      destinationParentId != null &&
      destinationParentId !== dragItem.doc.parentId;
    if (!changesParent) {
      return false;
    }
  }

  if (!isAllowDragItem(dragItem)) {
    return false;
  }

  const dropIsProject = realDropItem.kind === 'project';
  const dragInCloud = models.project.isRemoteProject(dragItem.project);
  if (dragItem.kind === 'workspace') {
    const dragWorkspaceScope = dragItem.doc.scope;
    if (realDropItem) {
      if (realDropItem.kind === 'project') {
        const dropToAnotherProject = dragItem.project._id !== realDropItem.doc._id;
        // only allow moving collection and design workspace into another project
        if (dropToAnotherProject && !allowCrossProjectDropWorkspaceScope.includes(dragWorkspaceScope)) {
          return false;
        }
        if (dropToAnotherProject && (dragInCloud || models.project.isRemoteProject(realDropItem.doc))) {
          // can not move cloud sync workspace into another project, and can not move any workspace into cloud sync project
          return false;
        }
        return true;
      }
      const isWorkspaceMoveAllowed = () => {
        if (dragInCloud) {
          // cloud sync workspaces can only move within same project and cannot move into other projects
          return (
            dragItem.project._id === realDropItem.project._id && models.project.isRemoteProject(realDropItem.project)
          );
        }
        const dropToAnotherProject = dragItem.project._id !== realDropItem.project._id;
        // only allow moving collection and design workspace into another project
        if (dropToAnotherProject && !allowCrossProjectDropWorkspaceScope.includes(dragWorkspaceScope)) {
          return false;
        }
        // local/git workspace can move within same project or move into other local/git project
        return !models.project.isRemoteProject(realDropItem.project);
      };
      if (realDropItem.kind === 'workspace') {
        if (realDropItem.doc.scope === 'collection' && expandedProjectAndWorkspaceIds?.includes(realDropItem.doc._id)) {
          // Can not drop on expanded collection
          return false;
        }
        return isWorkspaceMoveAllowed();
      }
      if (realDropItem.kind === 'collectionChild') {
        // Drop after a collection child who is the last element of its parent workspace
        const isLastChildOfWorkspace =
          itemAfterRealDrop == null ||
          itemAfterRealDrop.kind !== 'collectionChild' ||
          itemAfterRealDrop.workspace._id !== realDropItem.workspace._id;
        if (!isLastChildOfWorkspace) {
          return false;
        }
        return isWorkspaceMoveAllowed();
      }
    }

    return false;
  }

  // move other things into project is not allowed
  if (dropIsProject) {
    return false;
  }

  // move request and request group into collection
  if (
    realDropItem.kind === 'workspace' &&
    models.workspace.isCollection(realDropItem.doc) &&
    (models.requestGroup.isRequestGroup(dragItem.doc) || models.request.isRequest(dragItem.doc))
  ) {
    // Repositioning inside its own collection is not a cross-collection move, so
    // the cloud rule below does not apply.
    if (isCollectionChild(dragItem) && dragItem.workspace._id === realDropItem.doc._id) {
      return true;
    }
    // Moving BETWEEN collections cannot involve cloud sync on either side.
    const dropInCloud = models.project.isRemoteProject(realDropItem.project);
    return !dragInCloud && !dropInCloud;
  }

  // An empty PROJECT or COLLECTION placeholder has no sibling list to join. An
  // empty FOLDER's does, since it stands in for that folder's interior.
  if (realDropItem.kind === 'workspace' || (isEmptyNode(realDropItem) && realDropItem.kind !== 'emptyFolder')) {
    return false;
  }

  return true;
}

// Widens react-aria's 5px before/after band around an "on"-capable row.
const EDGE_PX = 10;

interface VirtualRow {
  key: string | number | bigint;
  start: number;
  end: number;
  size: number;
}

// Hit-tests from the virtualizer's row geometry, with no DOM measurement. Knows
// only row positions; normalizeBoundaryTarget interprets the result.
export class SidebarDropTargetDelegate {
  private depthOffset = 0;
  private onHoverLevelChange: ((level: number) => void) | null = null;
  private pxPerRem = FALLBACK_PX_PER_REM;

  constructor(private virtualizer: Virtualizer<HTMLDivElement, Element>) {}

  // onHoverLevelChange is setState-backed: React bails out on an unchanged
  // value, so calling it every dragover only re-renders when the level moves.
  configure(depthOffset: number, onHoverLevelChange: (level: number) => void) {
    this.depthOffset = depthOffset;
    this.onHoverLevelChange = onHoverLevelChange;
  }

  // Once per drag: it can't change mid-drag, and reading it per pointer hit
  // forces a style recalculation in the drag hot path.
  sampleRootFontSize() {
    this.pxPerRem = measurePxPerRem();
  }

  private classify(
    contentY: number,
    virtualItems: VirtualRow[],
    isValidDropTarget: (target: DropTarget) => boolean,
  ): DropTarget {
    let matchIndex = virtualItems.findIndex(v => contentY >= v.start && contentY < v.end);
    if (matchIndex === -1) {
      matchIndex = contentY < virtualItems[0].start ? 0 : virtualItems.length - 1;
    }
    const match = virtualItems[matchIndex];

    // Virtual item keys can technically be bigint; our own keys are always
    // doc ids (strings), and react-aria's Key type doesn't include bigint.
    const key = String(match.key);
    const onTarget: ItemDropTarget = { type: 'item', key, dropPosition: 'on' };
    const { start, end, size } = match;

    if (isValidDropTarget(onTarget)) {
      const edge = Math.min(EDGE_PX, size / 3);
      if (contentY <= start + edge) {
        const before: ItemDropTarget = { ...onTarget, dropPosition: 'before' };
        if (isValidDropTarget(before)) {
          return before;
        }
      }
      if (contentY >= end - edge) {
        const after: ItemDropTarget = { ...onTarget, dropPosition: 'after' };
        if (isValidDropTarget(after)) {
          return after;
        }
      }
      return onTarget;
    }

    const mid = start + size / 2;
    if (contentY <= mid) {
      const before: ItemDropTarget = { ...onTarget, dropPosition: 'before' };
      if (isValidDropTarget(before)) {
        return before;
      }
    }
    const after: ItemDropTarget = { ...onTarget, dropPosition: 'after' };
    if (isValidDropTarget(after)) {
      return after;
    }
    return onTarget;
  }

  getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget {
    this.onHoverLevelChange?.(levelFromX(x, this.depthOffset, this.pxPerRem));

    const virtualItems = this.virtualizer.getVirtualItems();
    if (virtualItems.length === 0) {
      return { type: 'root' };
    }

    // Do NOT add scrollOffset: react-aria measures y against the GridList, which
    // is inside the scroller at full content height, so the offset cancels out.
    return this.classify(y, virtualItems, isValidDropTarget);
  }
}

interface SidebarDropIndicatorProps {
  target: ItemDropTarget;
  rowStart: number;
  rowEnd: number;
  rowHeight: number;
  isValid: boolean;
  // Indent matching the level the item will land at.
  indentRem: number;
  folderName: string | null;
}

function SidebarDropIndicator({
  target,
  rowStart,
  rowEnd,
  rowHeight,
  isValid,
  indentRem,
  folderName,
}: SidebarDropIndicatorProps) {
  const outlineClass = isValid ? 'outline-(--color-surprise)' : 'outline-(--color-danger)';

  // "on" means inside: outline the whole row rather than draw a line.
  if (target.dropPosition === 'on') {
    return (
      <DropIndicator
        target={target}
        className={`absolute right-1 left-1 z-10 flex items-center rounded-sm outline-2 outline-solid ${outlineClass}`}
        style={{ transform: `translateY(${rowStart}px)`, height: `${rowHeight}px` }}
      >
        <Icon
          icon="turn-down"
          className={`ml-2 h-3 w-3 ${isValid ? 'text-(--color-surprise)' : 'text-(--color-danger)'}`}
        />
      </DropIndicator>
    );
  }

  return (
    <DropIndicator
      target={target}
      className={`absolute top-0 z-10 outline-1 outline-solid ${outlineClass}`}
      style={{
        left: `${indentRem}rem`,
        right: 0,
        transform: `translateY(${target.dropPosition === 'before' ? rowStart : rowEnd}px)`,
      }}
    >
      {folderName ? (
        <span
          className={`absolute -top-2.5 left-0 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${
            isValid
              ? 'bg-(--color-surprise) text-(--color-font-surprise)'
              : 'bg-(--color-danger) text-(--color-font-danger)'
          }`}
        >
          <Icon icon="turn-down" className="h-2.5 w-2.5" />
          {folderName}
        </span>
      ) : (
        <span
          className={`absolute -top-0.75 -left-0.75 block h-1.75 w-1.75 rounded-full ${
            isValid ? 'bg-(--color-surprise)' : 'bg-(--color-danger)'
          }`}
        />
      )}
    </DropIndicator>
  );
}

interface UseSidebarDragAndDropOptions {
  flatItems: FlatItem[];
  organizationId: string;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  onWorkspaceReorder?: (
    sourceProjectId: string,
    targetProjectId: string,
    draggedId: string,
    // null means drop to the first position in the target project
    targetWorkspaceId: string | null,
    dropPosition: 'before' | 'after',
  ) => void;
  expandedProjectAndWorkspaceIds?: string[];
  // Ancestor indent levels stripped from row rendering (see request-node.tsx).
  depthOffset?: number;
}

export const useSidebarDragAndDrop = ({
  flatItems,
  organizationId,
  virtualizer,
  onWorkspaceReorder,
  expandedProjectAndWorkspaceIds,
  depthOffset = 0,
}: UseSidebarDragAndDropOptions): DragAndDropHooks => {
  const reorderFetcher = useDebugReorderActionFetcher();

  const flatItemsById = useMemo(() => {
    const visibles = flatItems.filter(item => !item.hidden);
    // keep previous item for "move into collection/project" logic, also previous and next item
    return new Map(
      visibles.map((item, index) => [item.doc._id, [item, visibles[index - 1], visibles[index + 1]]] as const),
    );
  }, [flatItems]);

  const dropTargetDelegateRef = useRef<SidebarDropTargetDelegate | null>(null);
  if (!dropTargetDelegateRef.current) {
    dropTargetDelegateRef.current = new SidebarDropTargetDelegate(virtualizer);
  }

  // Nesting level the cursor's x selects, for gaps spanning several depths.
  const [hoverLevel, setHoverLevel] = useState(0);
  dropTargetDelegateRef.current.configure(depthOffset, setHoverLevel);

  // Whether the folder currently shows an interior to drop into — which an
  // expanded but childless folder does, via its placeholder row.
  const hasVisibleChildren = useCallback<HasVisibleChildren>(
    folderId =>
      flatItems.some(candidate => {
        if (candidate.hidden) {
          return false;
        }
        if (candidate.kind === 'emptyFolder') {
          return candidate.requestGroup?._id === folderId;
        }
        return candidate.kind === 'collectionChild' && candidate.doc.parentId === folderId;
      }),
    [flatItems],
  );

  const draggingCollectionItemIdRef = useRef<string | null>(null);

  const getCollectionItemByKey = useCallback(
    (key: string | number | symbol | null | undefined) => {
      if (key == null) {
        return null;
      }

      return flatItemsById.get(key.toString())?.[0] || null;
    },
    [flatItemsById],
  );

  const dropContext: DropContext = {
    hasVisibleChildren,
    lookup: getCollectionItemByKey,
    flatItemsById,
    preferredLevel: hoverLevel,
  };

  const collectionDragAndDrop = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    // Without this, the browser allows copy/move/link and picks the cursor icon itself,
    // which shows up as a flickering "+" (copy) cursor instead of a stable move cursor.
    getAllowedDropOperations: () => ['move'],
    // Our own delegate replaces react-aria's default hit-testing (which uses
    // a hardcoded, easy-to-jitter-across 5px edge band) with wider zones
    // computed from the virtualizer's own row geometry.
    dropTargetDelegate: dropTargetDelegateRef.current,
    onDragStart(event) {
      const [draggedKey] = event.keys;
      draggingCollectionItemIdRef.current = draggedKey?.toString() || null;
      dropTargetDelegateRef.current?.sampleRootFontSize();
    },
    onDragEnd() {
      draggingCollectionItemIdRef.current = null;
      // Or the next drag opens against this one's last cursor column.
      setHoverLevel(0);
    },
    getDropOperation(target, _types) {
      if (target.type !== 'item') {
        return 'cancel';
      }
      if (target.dropPosition === 'on') {
        const dropItem = getCollectionItemByKey(target.key);
        // Only allow the "on" drop position (move inside) for folders. This lets
        // react-aria carve out real before/after edge zones for every other row,
        // instead of the whole row being one big "move inside" target.
        if (isFolderItem(dropItem)) {
          return 'move';
        }
        return 'cancel';
      }
      return 'move';
    },
    onMove(event) {
      const { type, dropPosition: rawDropPosition, key } = event.target;
      if (type !== 'item') {
        return;
      }
      let dropPosition = rawDropPosition;
      const isBefore = dropPosition === 'before';
      const droppedKey = key.toString();

      const [draggedKey] = event.keys;
      const draggedItem = getCollectionItemByKey(draggedKey) as AllowDragItem | null;
      const targetItem = getCollectionItemByKey(droppedKey) as AllowDropTarget | null;
      const realTargetItem = isBefore ? flatItemsById.get(droppedKey)?.[1] : targetItem;
      const nextTargetItem = flatItemsById.get(droppedKey)?.[2];
      // Resolved from the RAW target, the same way the indicator resolves it.
      const boundary: BoundaryTargets | null = targetItem && {
        dropPosition: rawDropPosition,
        targetItem,
        realTargetItem,
        nextItem: nextTargetItem,
      };
      const resolved = boundary ? resolveDrop(boundary, dropContext) : null;
      const destinationParentId = resolved?.parentId ?? null;
      if (
        !draggedItem ||
        !targetItem ||
        !boundary ||
        !resolved ||
        !canDrop(draggedItem, boundary, resolved, expandedProjectAndWorkspaceIds)
      ) {
        return;
      }

      // move workspace to another project or reorder within same project
      if (draggedItem.kind === 'workspace') {
        if (rawDropPosition === 'on') {
          return;
        }
        // Dropping after the last child of a collection
        if (realTargetItem?.kind === 'collectionChild') {
          const targetProjectId = realTargetItem.project._id;
          const isDropToAnotherProject = targetProjectId !== draggedItem.project._id;
          if (isDropToAnotherProject) {
            reorderFetcher.submit({
              organizationId,
              projectId: draggedItem.project._id,
              workspaceId: draggedItem.doc._id,
              params: {
                type: 'move-workspace',
                targetId: targetProjectId,
                id: draggedItem.doc._id,
              },
            });
          }
          onWorkspaceReorder?.(
            draggedItem.project._id,
            targetProjectId,
            draggedItem.doc._id,
            realTargetItem.workspace._id,
            'after',
          );
          return;
        }
        const isDropToAnotherProject =
          (realTargetItem?.kind === 'project' && realTargetItem.doc._id !== draggedItem.project._id) ||
          (realTargetItem?.kind === 'workspace' && realTargetItem.project._id !== draggedItem.project._id);
        if (isDropToAnotherProject) {
          // Move workspace to another project
          reorderFetcher.submit({
            organizationId,
            projectId: draggedItem.project._id,
            workspaceId: draggedItem.doc._id,
            params: {
              type: 'move-workspace',
              targetId: realTargetItem?.kind === 'workspace' ? realTargetItem.project._id : realTargetItem!.doc._id,
              id: draggedItem.doc._id,
            },
          });
          const targetProjectId =
            realTargetItem?.kind === 'project' ? realTargetItem.doc._id : realTargetItem!.project._id;
          if (realTargetItem.kind === 'project') {
            onWorkspaceReorder?.(draggedItem.project._id, targetProjectId, draggedItem.doc._id, null, 'before');
          } else if (targetItem) {
            onWorkspaceReorder?.(
              draggedItem.project._id,
              targetProjectId,
              draggedItem.doc._id,
              targetItem.doc._id,
              rawDropPosition,
            );
          }
        } else {
          if (realTargetItem?.kind === 'project') {
            onWorkspaceReorder?.(draggedItem.project._id, draggedItem.project._id, draggedItem.doc._id, null, 'before');
          } else if (realTargetItem?.kind === 'workspace') {
            onWorkspaceReorder?.(
              draggedItem.project._id,
              draggedItem.project._id,
              draggedItem.doc._id,
              targetItem.doc._id,
              rawDropPosition,
            );
          }
        }
        return;
      }

      // move request or request group into collection
      if (realTargetItem?.kind === 'workspace' && models.workspace.isCollection(realTargetItem!.doc)) {
        const firstChildOfCollection = flatItems.find(
          (item): item is CollectionChildFlatItem =>
            item.kind === 'collectionChild' && item.doc.parentId === realTargetItem!.doc._id,
        );
        reorderFetcher.submit({
          organizationId,
          projectId: draggedItem.project._id,
          workspaceId: draggedItem.workspace._id,
          params: {
            targetId: realTargetItem!.doc._id,
            id: draggedItem.doc._id,
            dropPosition: 'after', // collection only accepts move into, so treat all drops as "after"
            metaSortKey: firstChildOfCollection?.doc.metaSortKey != null ? firstChildOfCollection.doc.metaSortKey - 100 : -1 * Date.now(),
          },
        });
        return;
      }

      const normalized = normalizeBoundaryTarget(boundary, dropContext);
      dropPosition = normalized.dropPosition;
      // normalizeBoundaryTarget only ever swaps in a 'collectionChild'.
      const normalizedTargetItem = normalized.targetItem as AllowDropTarget;

      const id = draggedItem.doc._id;
      let targetId = normalizedTargetItem.doc._id;
      const targetIsEmptyNode = isEmptyNode(normalizedTargetItem);
      const workspaceCollectionItems = flatItems.filter(
        (item): item is CollectionChildFlatItem =>
          item.kind === 'collectionChild' && item.workspace._id === draggedItem.workspace._id,
      );
      let metaSortKey = 0;
      const isMovingItemInsideFolder = dropPosition === 'on' && isFolderItem(normalizedTargetItem);
      const isMovingIntoEmptyFolder = targetIsEmptyNode && isFolderItem(realTargetItem);

      if (isMovingItemInsideFolder) {
        // Sort ahead of the folder's current first child so it lands at the top.
        const children = workspaceCollectionItems.filter(item => item.doc.parentId === targetId);
        metaSortKey = children.length > 0 ? children[0].doc.metaSortKey - 100 : -1 * Date.now();
      } else if (isMovingIntoEmptyFolder) {
        // The placeholder has no doc of its own to sort against, so target the
        // folder that owns it; parentId below puts the item inside that folder.
        targetId = realTargetItem.doc._id;
        metaSortKey = -1 * Date.now();
      } else {
        // move before or after another request in same or different collection
        const siblingItems = workspaceCollectionItems.filter(
          item => 'parentId' in normalizedTargetItem.doc && item.doc.parentId === normalizedTargetItem.doc.parentId,
        );
        const targetIndex = siblingItems.findIndex(item => item.doc._id === targetId);

        if ('metaSortKey' in normalizedTargetItem.doc && normalizedTargetItem.doc.metaSortKey != null) {
          if (dropPosition === 'after') {
            const afterItem = siblingItems[targetIndex + 1];
            metaSortKey = afterItem
              ? normalizedTargetItem.doc.metaSortKey -
                (normalizedTargetItem.doc.metaSortKey - afterItem.doc.metaSortKey) / 2
              : normalizedTargetItem.doc.metaSortKey + 100;
          } else {
            const beforeItem = siblingItems[targetIndex - 1];
            metaSortKey = beforeItem
              ? normalizedTargetItem.doc.metaSortKey -
                (normalizedTargetItem.doc.metaSortKey - beforeItem.doc.metaSortKey) / 2
              : normalizedTargetItem.doc.metaSortKey - 100;
          }
        }
      }

      if (!metaSortKey) {
        return;
      }

      reorderFetcher.submit({
        organizationId,
        projectId: draggedItem.project._id,
        workspaceId: draggedItem.workspace._id,
        params: {
          targetId,
          id,
          dropPosition,
          metaSortKey,
          parentId: destinationParentId ?? undefined,
        },
      });
    },
    renderDropIndicator(target) {
      const row =
        target.type === 'item'
          ? virtualizer.getVirtualItems().find(virtualItem => virtualItem.key === target.key)
          : undefined;
      if (target.type !== 'item' || !row) {
        return (
          <DropIndicator
            target={target}
            className="absolute top-0 left-0 outline-1 outline-(--color-surprise) outline-solid"
          />
        );
      }

      const entry = flatItemsById.get(target.key.toString());
      const draggedItem = getCollectionItemByKey(draggingCollectionItemIdRef.current);
      const targetItem = getCollectionItemByKey(target.key);
      const boundary: BoundaryTargets | null = targetItem && {
        dropPosition: target.dropPosition,
        targetItem,
        realTargetItem: target.dropPosition === 'before' ? entry?.[1] : targetItem,
        nextItem: entry?.[2],
      };

      // One pass drives validity, indent and the named destination.
      const resolved = boundary ? resolveDrop(boundary, dropContext) : null;
      const isValid =
        draggedItem != null &&
        boundary != null &&
        resolved != null &&
        canDrop(draggedItem, boundary, resolved, expandedProjectAndWorkspaceIds);

      return (
        <SidebarDropIndicator
          target={target}
          rowStart={row.start}
          rowEnd={row.end}
          rowHeight={row.size}
          isValid={isValid}
          indentRem={indentRemForLevel(resolved?.landingLevel ?? 0, depthOffset)}
          // A rejected boundary must not name a folder.
          folderName={isValid ? (resolved?.folderName ?? null) : null}
        />
      );
    },
  });

  // useDragAndDrop gives us collection-wide hooks. Wrap them once so project/workspace
  // rows stay non-draggable while collection rows keep the original drag behavior.
  return useMemo(() => {
    const originalUseDraggableItem = collectionDragAndDrop.dragAndDropHooks.useDraggableItem;
    if (!originalUseDraggableItem) {
      return collectionDragAndDrop.dragAndDropHooks;
    }

    return {
      ...collectionDragAndDrop.dragAndDropHooks,
      useDraggableItem(props, state) {
        const draggableItem = originalUseDraggableItem(props, state);
        const flatItem = flatItemsById.get(props.key.toString())?.[0];
        const isDraggable = ['collectionChild', 'workspace'].includes(flatItem?.kind || '');

        if (!isDraggable) {
          return {
            ...draggableItem,
            dragProps: {
              ...draggableItem.dragProps,
              draggable: 'false',
            },
            dragButtonProps: {
              ...draggableItem.dragButtonProps,
              isDisabled: true,
            },
          };
        }

        return draggableItem;
      },
    };
  }, [collectionDragAndDrop.dragAndDropHooks, flatItemsById]);
};
