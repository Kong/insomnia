import { parse as parseYaml } from 'yaml';

/**
 * Visual diff card coverage tracker.
 *
 * A git-tracked file is a whole Insomnia v5 workspace export (see
 * `common/import-v5-parser.ts`), containing many entities in one YAML blob.
 * This module walks both sides of the diff, matches entities by `meta.id`,
 * and produces one `EntityDiff` per changed/added/removed entity so the UI
 * can render a dedicated card per entity instead of one big text diff.
 *
 * Entities without a dedicated card fall back to `GenericEntityDiffCard`
 * (bullet list of raw field changes). Status of dedicated visual cards:
 *
 * - [x] Request (HTTP)      -> RequestDiffCard
 * - [x] Environment          -> EnvironmentDiffCard
 * - [x] Request Group (folder) -> RequestGroupDiffCard
 * - [x] WebSocket Request    -> WebSocketDiffCard
 * - [x] gRPC Request         -> GrpcDiffCard
 * - [x] Socket.IO Request    -> SocketIODiffCard
 * - [ ] MCP Request
 * - [ ] Mock Route
 * - [ ] Cookie Jar
 */

// TODO: Bind type from Insomnia v5 entity definitions (eg. `Request`, `Environment`, etc.) rather than hardcoding strings.
// TODO: What if the type changes for an existing entity? How should the diff engine handle it?

export type VisualDiffEntityType =
  | 'request'
  | 'grpc_request'
  | 'websocket_request'
  | 'socketio_request'
  | 'request_group'
  | 'environment'
  | 'mock_route'
  | 'mcp_request'
  | 'cookie_jar'
  | 'unknown';

export type EntityChangeStatus = 'added' | 'removed' | 'modified';

export interface FieldChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface EntityDiff {
  id: string;
  type: VisualDiffEntityType;
  status: EntityChangeStatus;
  name: string;
  before: any;
  after: any;
  fieldChanges: FieldChange[];
}

export interface VisualDiffResult {
  entities: EntityDiff[];
  // True when neither side could be parsed as a recognizable Insomnia v5 file.
  unparseable: boolean;
}

interface CollectedEntity {
  type: VisualDiffEntityType;
  name: string;
  node: any;
}

// Recursively sorts object keys (and maps over arrays) so two structurally
// equal values serialize to the same JSON string regardless of key order.
function sortDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortDeep(value[key])]),
    );
  }
  return value;
}

// undefined, null and empty string are treated as equivalent so schema defaults don't create noise
function emptyValueReplacer(_key: string, value: any) {
  if (value === null || value === '') {
    return;
  }
  return value;
}

// Deep-equality check used throughout the diff engine: key order doesn't
// matter (via sortDeep) and null/undefined/'' are treated as equivalent
// (via emptyValueReplacer).
export function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortDeep(a), emptyValueReplacer) === JSON.stringify(sortDeep(b), emptyValueReplacer);
}

// Strips volatile/structural meta fields (modified/created/sortKey/id) before
// comparing two entities' meta blocks, so only user-visible fields (eg.
// description) are treated as a meaningful change.
function cleanMeta(meta: any) {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }
  const { modified, created, sortKey, id, ...rest } = meta;
  return rest;
}

// Keys that are structural (handled by entity matching itself) rather than displayable fields
const STRUCTURAL_KEYS = new Set(['children', 'subEnvironments']);

// An entity node minus its nested entities (eg. a folder's `children`), which get their own cards.
export function ownFields(node: any): any {
  if (!node || typeof node !== 'object') {
    return node;
  }
  return Object.fromEntries(Object.entries(node).filter(([key]) => !STRUCTURAL_KEYS.has(key)));
}

// Compares two entity nodes field-by-field and returns one FieldChange per
// differing key, skipping structural keys (handled by entity matching) and
// reporting `meta` per sub-field (eg. `meta.description`), minus volatile ones.
export function computeFieldChanges(before: any, after: any): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];

  for (const key of keys) {
    if (STRUCTURAL_KEYS.has(key)) {
      continue;
    }

    if (key === 'meta') {
      const beforeMeta = cleanMeta(before?.meta) ?? {};
      const afterMeta = cleanMeta(after?.meta) ?? {};
      for (const metaKey of new Set([...Object.keys(beforeMeta), ...Object.keys(afterMeta)])) {
        if (!valuesEqual(beforeMeta[metaKey], afterMeta[metaKey])) {
          changes.push({
            path: `meta.${metaKey}`,
            label: humanizeKey(metaKey),
            before: beforeMeta[metaKey],
            after: afterMeta[metaKey],
          });
        }
      }
      continue;
    }

    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    if (!valuesEqual(beforeValue, afterValue)) {
      changes.push({ path: key, label: humanizeKey(key), before: beforeValue, after: afterValue });
    }
  }

  return changes;
}

// Turns a camelCase/snake_case/kebab-case field name into a human-readable
// label (eg. `pathParameters` -> "Path parameters") for display in a card.
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, c => c.toUpperCase());
}

export interface KeyedDiffRow {
  key: string;
  status: EntityChangeStatus;
  before?: unknown;
  after?: unknown;
}

// Single status representing a set of rows (eg. for a tab/chip badge): all-added
// or all-removed collapse to that status, anything mixed (or any modified row)
// reads as 'modified'.
export function dominantStatus(statuses: EntityChangeStatus[]): EntityChangeStatus {
  const hasAdded = statuses.includes('added');
  const hasRemoved = statuses.includes('removed');
  const hasModified = statuses.includes('modified');
  if (hasModified || (hasAdded && hasRemoved)) {
    return 'modified';
  }
  if (hasAdded) {
    return 'added';
  }
  if (hasRemoved) {
    return 'removed';
  }
  return 'modified';
}

// Status for a single before/after block (eg. a request's body or auth config)
// based only on which side has content — content only on one side reads as
// added/removed even when the entity itself is 'modified'.
export function sideStatus(hasBefore: boolean, hasAfter: boolean): EntityChangeStatus {
  if (!hasBefore && hasAfter) {
    return 'added';
  }
  if (hasBefore && !hasAfter) {
    return 'removed';
  }
  return 'modified';
}

// Diffs two arrays of objects by matching a key field (eg. header/parameter `name`) instead of position
export function diffByKey<T extends Record<string, any>>(
  before: T[] = [],
  after: T[] = [],
  keyField: keyof T = 'name' as keyof T,
): KeyedDiffRow[] {
  const rows: KeyedDiffRow[] = [];

  const beforeMap = new Map<string, T>();
  (before ?? []).forEach((item, i) => beforeMap.set(String(item?.[keyField] ?? `#${i}`), item));

  const afterMap = new Map<string, T>();
  (after ?? []).forEach((item, i) => afterMap.set(String(item?.[keyField] ?? `#${i}`), item));

  afterMap.forEach((afterItem, key) => {
    const beforeItem = beforeMap.get(key);
    if (!beforeItem) {
      rows.push({ key, status: 'added', after: afterItem });
    } else if (!valuesEqual(beforeItem, afterItem)) {
      rows.push({ key, status: 'modified', before: beforeItem, after: afterItem });
    }
  });

  beforeMap.forEach((beforeItem, key) => {
    if (!afterMap.has(key)) {
      rows.push({ key, status: 'removed', before: beforeItem });
    }
  });

  return rows;
}

// Diffs a plain key/value record (eg. environment `data`) by key
export function diffRecord(before: Record<string, any> = {}, after: Record<string, any> = {}): KeyedDiffRow[] {
  const rows: KeyedDiffRow[] = [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  keys.forEach(key => {
    const hasBefore = before != null && Object.prototype.hasOwnProperty.call(before, key);
    const hasAfter = after != null && Object.prototype.hasOwnProperty.call(after, key);
    const beforeValue = before?.[key];
    const afterValue = after?.[key];

    if (!hasBefore) {
      rows.push({ key, status: 'added', after: afterValue });
    } else if (!hasAfter) {
      rows.push({ key, status: 'removed', before: beforeValue });
    } else if (!valuesEqual(beforeValue, afterValue)) {
      rows.push({ key, status: 'modified', before: beforeValue, after: afterValue });
    }
  });

  return rows;
}

// Determines a collection tree node's entity type from its `meta.id` prefix
// (eg. `req_` -> request, `fld_` -> folder), falling back to shape-sniffing
// (`children` array / `method` string) if the id is missing or unrecognized.
function classifyCollectionNode(node: any): VisualDiffEntityType {
  const id: string = node?.meta?.id ?? '';
  if (id.startsWith('ws-req')) {
    return 'websocket_request';
  }
  if (id.startsWith('socketio-req')) {
    return 'socketio_request';
  }
  if (id.startsWith('greq')) {
    return 'grpc_request';
  }
  if (id.startsWith('fld')) {
    return 'request_group';
  }
  if (id.startsWith('req')) {
    return 'request';
  }
  // Fall back to structural shape in case an id is missing/unrecognized
  if (Array.isArray(node?.children)) {
    return 'request_group';
  }
  if (typeof node?.method === 'string') {
    return 'request';
  }
  return 'unknown';
}

// Walks a parsed Insomnia v5 file (collection tree, environments, mock
// routes, MCP request, cookie jar) and flattens every entity it finds into a
// single `id -> CollectedEntity` map, so both sides of a diff can be matched
// up by id regardless of where in the tree they live.
function collectEntities(file: any): Map<string, CollectedEntity> {
  const map = new Map<string, CollectedEntity>();
  if (!file || typeof file !== 'object') {
    return map;
  }

  // Recursively registers a collection-tree node (request/folder/etc.) and its children.
  const addCollectionNode = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const id = node.meta?.id;
    if (id) {
      map.set(id, { type: classifyCollectionNode(node), name: node.name || 'Untitled', node });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(addCollectionNode);
    }
  };

  // Registers a base environment and each of its sub-environments as separate entities.
  const addEnvironmentTree = (env: any, fallbackName: string) => {
    if (!env || typeof env !== 'object') {
      return;
    }
    const id = env.meta?.id;
    if (id) {
      map.set(id, { type: 'environment', name: env.name || fallbackName, node: env });
    }
    (env.subEnvironments ?? []).forEach((sub: any, index: number) => {
      const subId = sub?.meta?.id;
      if (subId) {
        map.set(subId, { type: 'environment', name: sub.name || `Environment ${index}`, node: sub });
      }
    });
  };

  if (Array.isArray(file.collection)) {
    file.collection.forEach(addCollectionNode);
  }

  if (file.environments) {
    addEnvironmentTree(file.environments, 'Base Environment');
  }

  if (Array.isArray(file.routes)) {
    file.routes.forEach((route: any) => {
      const id = route?.meta?.id;
      if (id) {
        map.set(id, { type: 'mock_route', name: route.name || route.pattern || 'Mock Route', node: route });
      }
    });
  }

  if (file.mcpRequest) {
    const id = file.mcpRequest.meta?.id;
    if (id) {
      map.set(id, { type: 'mcp_request', name: file.mcpRequest.name || 'MCP Request', node: file.mcpRequest });
    }
  }

  if (file.cookieJar) {
    const id = file.cookieJar.meta?.id ?? 'cookie-jar';
    map.set(id, { type: 'cookie_jar', name: file.cookieJar.name || 'Cookie Jar', node: file.cookieJar });
  }

  // TODO: Handle more Insomnia v5 entities in the future

  return map;
}

// Parses YAML text into a plain object, swallowing parse errors and
// returning `undefined` instead so a malformed/empty side of the diff
// degrades gracefully rather than throwing.
function safeParseYaml(text: string): any {
  if (!text) {
    return undefined;
  }
  try {
    return parseYaml(text);
  } catch {
    return undefined;
  }
}

// Entry point of the diff engine: parses both sides of a git-tracked file as
// YAML, collects every entity on each side, matches them up by id, and
// returns the added/removed/modified `EntityDiff` list the UI renders cards
// from.
export function computeVisualDiff(beforeText: string, afterText: string): VisualDiffResult {
  const beforeFile = safeParseYaml(beforeText);
  const afterFile = safeParseYaml(afterText);

  const beforeEntities = collectEntities(beforeFile);
  const afterEntities = collectEntities(afterFile);

  const entities: EntityDiff[] = [];
  const visited = new Set<string>();

  afterEntities.forEach((afterEntity, id) => {
    visited.add(id);
    const beforeEntity = beforeEntities.get(id);

    if (!beforeEntity) {
      entities.push({
        id,
        type: afterEntity.type,
        status: 'added',
        name: afterEntity.name,
        before: undefined,
        after: afterEntity.node,
        fieldChanges: [],
      });
      return;
    }

    const fieldChanges = computeFieldChanges(beforeEntity.node, afterEntity.node);
    if (fieldChanges.length === 0) {
      return;
    }

    entities.push({
      id,
      type: afterEntity.type,
      status: 'modified',
      name: afterEntity.name,
      before: beforeEntity.node,
      after: afterEntity.node,
      fieldChanges,
    });
  });

  beforeEntities.forEach((beforeEntity, id) => {
    if (visited.has(id)) {
      return;
    }
    entities.push({
      id,
      type: beforeEntity.type,
      status: 'removed',
      name: beforeEntity.name,
      before: beforeEntity.node,
      after: undefined,
      fieldChanges: [],
    });
  });

  // A side with content that doesn't parse (eg. merge-conflict markers) can't be
  // reasoned about per entity — every entity would look added/removed, and
  // acting on one would rewrite the whole file from a partial view.
  const sideUnparseable = (text: string, file: unknown) => Boolean(text) && (file === undefined || file === null || typeof file !== 'object');

  return {
    entities,
    unparseable:
      (beforeFile === undefined && afterFile === undefined) ||
      sideUnparseable(beforeText, beforeFile) ||
      sideUnparseable(afterText, afterFile),
  };
}
