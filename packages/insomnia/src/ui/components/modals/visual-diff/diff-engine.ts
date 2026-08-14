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
 * - [ ] Request Group (folder)
 * - [ ] WebSocket Request
 * - [ ] gRPC Request
 * - [ ] Socket.IO Request
 * - [ ] MCP Request
 * - [ ] Mock Route
 * - [ ] Cookie Jar
 */

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

function sortDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortDeep(value[key])]));
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

export function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortDeep(a), emptyValueReplacer) === JSON.stringify(sortDeep(b), emptyValueReplacer);
}

function cleanMeta(meta: any) {
  if (!meta || typeof meta !== 'object') {
    return meta;
  }
  const { modified, created, sortKey, id, ...rest } = meta;
  return rest;
}

// Keys that are structural (handled by entity matching itself) rather than displayable fields
const STRUCTURAL_KEYS = new Set(['children', 'subEnvironments']);

export function computeFieldChanges(before: any, after: any): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];

  for (const key of keys) {
    if (STRUCTURAL_KEYS.has(key)) {
      continue;
    }

    if (key === 'meta') {
      const beforeMeta = cleanMeta(before?.meta);
      const afterMeta = cleanMeta(after?.meta);
      if (!valuesEqual(beforeMeta, afterMeta)) {
        changes.push({
          path: 'meta.description',
          label: 'Description',
          before: beforeMeta?.description,
          after: afterMeta?.description,
        });
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

function collectEntities(file: any): Map<string, CollectedEntity> {
  const map = new Map<string, CollectedEntity>();
  if (!file || typeof file !== 'object') {
    return map;
  }

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

  return map;
}

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

  return {
    entities,
    unparseable: beforeFile === undefined && afterFile === undefined,
  };
}
