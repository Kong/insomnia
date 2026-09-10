import { parse } from 'yaml';

/**
 * Diagnostic helper for the Git "Commit Changes" dialog.
 *
 * The YAML diff shown to the user mixes three very different kinds of change:
 * real edits, Insomnia-managed metadata (timestamps, sort keys) and pure
 * re-ordering of entries. This module classifies them so a support screenshot
 * is enough to tell them apart.
 */

export type ChangeVerdict = 'identical' | 'order-only' | 'metadata-only' | 'content-changed' | 'unparsable';

/** Fields Insomnia rewrites on its own; never a user edit. */
const METADATA_FIELDS = new Set(['meta.created', 'meta.modified', 'meta.sortKey', 'schema_version']);

/** Longest-first so `ws-req_` wins over `req_`. */
const ID_PREFIX_TO_KIND: [string, string][] = [
  ['socketio-req', 'Socket.IO Request'],
  ['mock-route', 'Mock Route'],
  ['ws-req', 'WebSocket Request'],
  ['mcp-req', 'MCP Request'],
  ['greq', 'gRPC Request'],
  ['mock', 'Mock Server'],
  ['wrk', 'Workspace'],
  ['fld', 'Folder'],
  ['req', 'Request'],
  ['env', 'Environment'],
  ['jar', 'Cookie Jar'],
  ['spc', 'API Spec'],
  ['uts', 'Test Suite'],
  ['pd', 'Proto Directory'],
  ['pf', 'Proto File'],
  ['ut', 'Unit Test'],
];

export interface FieldChange {
  field: string;
  before: string;
  after: string;
  isMetadata: boolean;
}

export interface EntityRef {
  id: string;
  kind: string;
  name: string;
  /** Human readable location, e.g. `My Collection / My Folder / Request in folder`. */
  path: string;
}

export interface ModifiedEntity extends EntityRef {
  fields: FieldChange[];
}

export interface ReorderedEntity extends EntityRef {
  container: string;
  fromIndex: number;
  toIndex: number;
}

export interface MovedEntity extends EntityRef {
  fromContainer: string;
  toContainer: string;
}

export interface InsomniaChangeReport {
  verdict: ChangeVerdict;
  parseErrors: { side: 'committed' | 'local'; message: string }[];
  stats: {
    beforeBytes: number;
    afterBytes: number;
    beforeLines: number;
    afterLines: number;
    beforeEntities: number;
    afterEntities: number;
    beforeSchemaVersion: string;
    afterSchemaVersion: string;
    textIdentical: boolean;
  };
  added: EntityRef[];
  removed: EntityRef[];
  moved: MovedEntity[];
  reordered: ReorderedEntity[];
  /** Entities with at least one non-metadata field change. */
  contentChanged: ModifiedEntity[];
  /** Entities whose only changes are Insomnia-managed metadata. */
  metadataChanged: ModifiedEntity[];
}

interface CollectedEntity {
  id: string;
  kind: string;
  name: string;
  path: string;
  container: string;
  index: number;
  leaves: Map<string, string>;
}

function kindFromId(id: string, value: Record<string, unknown>): string {
  for (const [prefix, kind] of ID_PREFIX_TO_KIND) {
    if (id.startsWith(`${prefix}_`)) {
      return kind;
    }
  }
  if (Array.isArray(value.children)) {
    return 'Folder';
  }
  if (typeof value.method === 'string') {
    return 'Request';
  }
  const underscore = id.indexOf('_');
  return underscore > 0 ? id.slice(0, underscore) : 'Item';
}

function entityId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const meta = record.meta;
  if (meta && typeof meta === 'object' && typeof (meta as Record<string, unknown>).id === 'string') {
    return (meta as Record<string, unknown>).id as string;
  }
  return undefined;
}

function serialiseLeaf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '(absent)';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Flattens the document into a map of entities (anything carrying a `meta.id`)
 * keyed by id, each holding its own scalar fields plus its position among its
 * siblings. Nested entities become their own entries rather than fields of the
 * parent, which is what lets us separate "moved" from "edited".
 */
function collectEntities(root: unknown): Map<string, CollectedEntity> {
  const entities = new Map<string, CollectedEntity>();

  const walkValue = (value: unknown, fieldPath: string, owner: CollectedEntity): void => {
    if (Array.isArray(value)) {
      const allEntities = value.length > 0 && value.every(item => entityId(item) !== undefined);
      if (allEntities) {
        const container = `${owner.path} › ${fieldPath || 'items'}`;
        value.forEach((item, index) => walkEntity(item as Record<string, unknown>, owner, container, index));
        return;
      }
      value.forEach((item, index) => walkValue(item, `${fieldPath}[${index}]`, owner));
      return;
    }

    if (value && typeof value === 'object') {
      if (fieldPath !== '' && entityId(value) !== undefined) {
        walkEntity(value as Record<string, unknown>, owner, `${owner.path} › ${fieldPath}`, 0);
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walkValue(child, fieldPath ? `${fieldPath}.${key}` : key, owner);
      }
      return;
    }

    owner.leaves.set(fieldPath, serialiseLeaf(value));
  };

  const walkEntity = (
    value: Record<string, unknown>,
    parent: CollectedEntity | null,
    container: string,
    index: number,
  ): void => {
    const id = entityId(value) as string;
    const name = typeof value.name === 'string' ? value.name : '';
    const label = name || id;
    const entity: CollectedEntity = {
      id,
      kind: kindFromId(id, value),
      name,
      path: parent ? `${parent.path} / ${label}` : label,
      container,
      index,
      leaves: new Map(),
    };
    // A duplicated id would silently drop entries; keep the first and move on.
    if (!entities.has(id)) {
      entities.set(id, entity);
    }
    walkValue(value, '', entity);
  };

  if (entityId(root) !== undefined) {
    walkEntity(root as Record<string, unknown>, null, '(file root)', 0);
  } else if (root && typeof root === 'object') {
    const synthetic: CollectedEntity = {
      id: '(file)',
      kind: 'File',
      name: '(file)',
      path: '(file)',
      container: '(file root)',
      index: 0,
      leaves: new Map(),
    };
    entities.set(synthetic.id, synthetic);
    walkValue(root, '', synthetic);
  }

  return entities;
}

function toRef(entity: CollectedEntity): EntityRef {
  return { id: entity.id, kind: entity.kind, name: entity.name, path: entity.path };
}

function diffLeaves(before: CollectedEntity, after: CollectedEntity): FieldChange[] {
  const fields: FieldChange[] = [];
  const keys = new Set([...before.leaves.keys(), ...after.leaves.keys()]);

  for (const key of [...keys].sort()) {
    const beforeValue = before.leaves.get(key) ?? '(absent)';
    const afterValue = after.leaves.get(key) ?? '(absent)';
    if (beforeValue !== afterValue) {
      fields.push({ field: key, before: beforeValue, after: afterValue, isMetadata: METADATA_FIELDS.has(key) });
    }
  }

  return fields;
}

function schemaVersionOf(parsed: unknown): string {
  if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).schema_version === 'string') {
    return (parsed as Record<string, unknown>).schema_version as string;
  }
  return '5.0 (no schema_version field)';
}

function countLines(text: string): number {
  return text ? text.split('\n').length : 0;
}

export function buildInsomniaChangeReport(
  beforeText: string | null | undefined,
  afterText: string | null | undefined,
): InsomniaChangeReport {
  const before = typeof beforeText === 'string' ? beforeText : '';
  const after = typeof afterText === 'string' ? afterText : '';

  const parseErrors: InsomniaChangeReport['parseErrors'] = [];
  let beforeParsed: unknown;
  let afterParsed: unknown;

  try {
    beforeParsed = parse(before);
  } catch (error) {
    parseErrors.push({ side: 'committed', message: error instanceof Error ? error.message : String(error) });
  }
  try {
    afterParsed = parse(after);
  } catch (error) {
    parseErrors.push({ side: 'local', message: error instanceof Error ? error.message : String(error) });
  }

  const beforeEntities = parseErrors.some(e => e.side === 'committed') ? new Map() : collectEntities(beforeParsed);
  const afterEntities = parseErrors.some(e => e.side === 'local') ? new Map() : collectEntities(afterParsed);

  const stats: InsomniaChangeReport['stats'] = {
    beforeBytes: before.length,
    afterBytes: after.length,
    beforeLines: countLines(before),
    afterLines: countLines(after),
    beforeEntities: beforeEntities.size,
    afterEntities: afterEntities.size,
    beforeSchemaVersion: schemaVersionOf(beforeParsed),
    afterSchemaVersion: schemaVersionOf(afterParsed),
    textIdentical: before === after,
  };

  if (parseErrors.length > 0) {
    return {
      verdict: 'unparsable',
      parseErrors,
      stats,
      added: [],
      removed: [],
      moved: [],
      reordered: [],
      contentChanged: [],
      metadataChanged: [],
    };
  }

  const added: EntityRef[] = [];
  const removed: EntityRef[] = [];
  const moved: MovedEntity[] = [];
  const contentChanged: ModifiedEntity[] = [];
  const metadataChanged: ModifiedEntity[] = [];

  for (const [id, entity] of beforeEntities) {
    if (!afterEntities.has(id)) {
      removed.push(toRef(entity));
    }
  }
  for (const [id, entity] of afterEntities) {
    if (!beforeEntities.has(id)) {
      added.push(toRef(entity));
    }
  }

  for (const [id, beforeEntity] of beforeEntities) {
    const afterEntity = afterEntities.get(id);
    if (!afterEntity) {
      continue;
    }

    if (beforeEntity.container !== afterEntity.container) {
      moved.push({
        ...toRef(afterEntity),
        fromContainer: beforeEntity.container,
        toContainer: afterEntity.container,
      });
    }

    const fields = diffLeaves(beforeEntity, afterEntity);
    if (fields.length === 0) {
      continue;
    }
    const realFields = fields.filter(field => !field.isMetadata);
    if (realFields.length > 0) {
      contentChanged.push({ ...toRef(afterEntity), fields });
    } else {
      metadataChanged.push({ ...toRef(afterEntity), fields });
    }
  }

  const reordered = detectReordering(beforeEntities, afterEntities);

  let verdict: ChangeVerdict = 'identical';
  if (contentChanged.length > 0 || added.length > 0 || removed.length > 0 || moved.length > 0) {
    verdict = 'content-changed';
  } else if (metadataChanged.length > 0) {
    verdict = 'metadata-only';
  } else if (reordered.length > 0) {
    verdict = 'order-only';
  }

  return { verdict, parseErrors, stats, added, removed, moved, reordered, contentChanged, metadataChanged };
}

/**
 * Compares sibling order per container, ignoring entries that only exist on one
 * side so an insertion doesn't make every following sibling look reordered.
 */
function detectReordering(
  beforeEntities: Map<string, CollectedEntity>,
  afterEntities: Map<string, CollectedEntity>,
): ReorderedEntity[] {
  const groupByContainer = (entities: Map<string, CollectedEntity>) => {
    const groups = new Map<string, CollectedEntity[]>();
    for (const entity of entities.values()) {
      const group = groups.get(entity.container);
      if (group) {
        group.push(entity);
      } else {
        groups.set(entity.container, [entity]);
      }
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.index - b.index);
    }
    return groups;
  };

  const beforeGroups = groupByContainer(beforeEntities);
  const afterGroups = groupByContainer(afterEntities);
  const reordered: ReorderedEntity[] = [];

  for (const [container, beforeGroup] of beforeGroups) {
    const afterGroup = afterGroups.get(container);
    if (!afterGroup) {
      continue;
    }

    const afterIds = new Set(afterGroup.map(entity => entity.id));
    const beforeIds = new Set(beforeGroup.map(entity => entity.id));
    const beforeCommon = beforeGroup.filter(entity => afterIds.has(entity.id));
    const afterCommon = afterGroup.filter(entity => beforeIds.has(entity.id));

    afterCommon.forEach((entity, toIndex) => {
      const fromIndex = beforeCommon.findIndex(candidate => candidate.id === entity.id);
      if (fromIndex !== -1 && fromIndex !== toIndex) {
        reordered.push({ ...toRef(entity), container, fromIndex, toIndex });
      }
    });
  }

  return reordered;
}

export const VERDICT_LABELS: Record<ChangeVerdict, string> = {
  'identical': 'No differences found',
  'order-only': 'Ordering only — no field values changed',
  'metadata-only': 'Insomnia metadata only (timestamps / sort keys)',
  'content-changed': 'Real content changes found',
  'unparsable': 'File could not be parsed as YAML',
};

/** Plain-text rendering so support can paste the report instead of screenshotting it. */
export function formatChangeReportAsText(
  report: InsomniaChangeReport,
  context: Record<string, string | number | boolean>,
): string {
  const lines: string[] = [];
  lines.push('=== Insomnia Git change analysis ===');
  for (const [key, value] of Object.entries(context)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push(
    `verdict: ${report.verdict} — ${VERDICT_LABELS[report.verdict]}`,
    `size: committed ${report.stats.beforeBytes}B/${report.stats.beforeLines} lines, ` +
      `local ${report.stats.afterBytes}B/${report.stats.afterLines} lines`,
    `schema_version: committed ${report.stats.beforeSchemaVersion} -> local ${report.stats.afterSchemaVersion}`,
    `entities: committed ${report.stats.beforeEntities}, local ${report.stats.afterEntities}`,
    `counts: added=${report.added.length} removed=${report.removed.length} moved=${report.moved.length} ` +
      `reordered=${report.reordered.length} contentChanged=${report.contentChanged.length} ` +
      `metadataOnly=${report.metadataChanged.length}`,
  );

  for (const error of report.parseErrors) {
    lines.push(`PARSE ERROR (${error.side}): ${error.message}`);
  }

  if (report.contentChanged.length > 0) {
    lines.push('', '--- Content changes ---');
    for (const entity of report.contentChanged) {
      lines.push(`[${entity.kind}] ${entity.path} (${entity.id})`);
      for (const field of entity.fields) {
        lines.push(`    ${field.isMetadata ? '(meta) ' : ''}${field.field}: ${field.before} -> ${field.after}`);
      }
    }
  }

  if (report.added.length > 0) {
    lines.push('', '--- Added ---');
    report.added.forEach(entity => lines.push(`[${entity.kind}] ${entity.path} (${entity.id})`));
  }
  if (report.removed.length > 0) {
    lines.push('', '--- Removed ---');
    report.removed.forEach(entity => lines.push(`[${entity.kind}] ${entity.path} (${entity.id})`));
  }
  if (report.moved.length > 0) {
    lines.push('', '--- Moved to a different parent ---');
    report.moved.forEach(entity =>
      lines.push(`[${entity.kind}] ${entity.path} (${entity.id}): ${entity.fromContainer} -> ${entity.toContainer}`),
    );
  }
  if (report.reordered.length > 0) {
    lines.push('', '--- Reordered (same parent, position changed) ---');
    report.reordered.forEach(entity =>
      lines.push(
        `[${entity.kind}] ${entity.path} (${entity.id}): #${entity.fromIndex} -> #${entity.toIndex} in ${entity.container}`,
      ),
    );
  }
  if (report.metadataChanged.length > 0) {
    lines.push('', '--- Insomnia metadata only ---');
    for (const entity of report.metadataChanged) {
      lines.push(`[${entity.kind}] ${entity.path} (${entity.id})`);
      for (const field of entity.fields) {
        lines.push(`    ${field.field}: ${field.before} -> ${field.after}`);
      }
    }
  }

  return lines.join('\n');
}
