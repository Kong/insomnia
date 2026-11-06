/**
 * Entity-level delta between the DB view of an Insomnia file and the DB itself,
 * plus the byte-range patch that applies it to the file on disk.
 *
 * An entity is any mapping that carries `meta.id` (the workspace, folders,
 * requests, environments, cookie jars, specs, routes, …). The base is the DB
 * view of the file: `export(import(file))`. The delta is the set of entities
 * that differ between that base and `export(DB)`, so it only describes what
 * Insomnia itself changed since the file was last imported.
 *
 * Applying the delta splices the canonical text of the affected entities into
 * the original file and leaves every other byte untouched: comments,
 * indentation, unknown fields and hand-ordered entries of untouched entities
 * survive.
 */

import { type Document, isMap, isScalar, isSeq, type Node, parseDocument, type YAMLMap } from 'yaml';

/**
 * Fields the importer fills in when they are missing (`Date.now()`), so they
 * differ between two DB views of the same file without meaning anything. They
 * never make an entity "changed" on their own.
 */
const IMPORT_DERIVED_LEAF_PATHS: Record<string, true> = { 'meta.created': true, 'meta.modified': true };
const IMPORT_DERIVED_META_KEYS: Record<string, true> = { created: true, modified: true };

export interface EntityDelta {
  /** File-root scalar paths whose value changed, eg. `name` or `meta.sortKey`. */
  leaves: string[];
  /** Entity ids whose canonical text changed. */
  replaced: string[];
  /** Entity ids present in the base but gone from the DB. */
  removed: string[];
  /** Entity ids present in the DB but missing from the base. */
  added: string[];
  /** Set when the base and the DB are not the same file at all. */
  unpatchable?: string;
}

export function isEmptyDelta(delta: EntityDelta): boolean {
  return (
    !delta.unpatchable &&
    delta.leaves.length === 0 &&
    delta.replaced.length === 0 &&
    delta.removed.length === 0 &&
    delta.added.length === 0
  );
}

interface CollectedEntity {
  id: string;
  node: YAMLMap;
  parentId: string | null;
  containerKey: string | null;
  index: number;
}

class EntityDeltaError extends Error {}

/**
 * A write parses the same content up to three times: once to compare entities,
 * once to take the source block of a replacement, once to verify the result.
 * Keeping the last few documents alive turns those repeats into lookups.
 */
const PARSE_CACHE_SIZE = 4;
const parseCache: { content: string; doc: Document.Parsed }[] = [];

function parseCached(content: string): Document.Parsed {
  for (let i = 0; i < parseCache.length; i++) {
    if (parseCache[i].content === content) {
      const [hit] = parseCache.splice(i, 1);
      parseCache.push(hit);
      return hit.doc;
    }
  }
  const doc = parseDocument(content);
  parseCache.push({ content, doc });
  if (parseCache.length > PARSE_CACHE_SIZE) {
    parseCache.shift();
  }
  return doc;
}

/**
 * What Insomnia changed between `baseContent` (the file as the DB sees it) and
 * `dbContent` (the file Insomnia would write now).
 */
export function computeEntityDelta(baseContent: string, dbContent: string): EntityDelta {
  const delta: EntityDelta = { leaves: [], replaced: [], removed: [], added: [] };

  let base: Document.Parsed;
  let db: Document.Parsed;
  try {
    base = parseCached(baseContent);
    db = parseCached(dbContent);
  } catch (err) {
    return { ...delta, unpatchable: err instanceof Error ? err.message : String(err) };
  }
  if (base.errors.length > 0 || db.errors.length > 0) {
    return { ...delta, unpatchable: 'unparseable YAML' };
  }

  const baseRoot = asMap(base.contents);
  const dbRoot = asMap(db.contents);
  const baseRootId = entityIdOf(baseRoot);
  const dbRootId = entityIdOf(dbRoot);
  if (!baseRoot || !dbRoot || !baseRootId || !dbRootId) {
    return { ...delta, unpatchable: 'not an Insomnia file' };
  }
  if (baseRootId !== dbRootId) {
    return { ...delta, unpatchable: `workspace id changed: ${baseRootId} -> ${dbRootId}` };
  }

  // The root holds the whole file, so it is patched leaf by leaf instead of
  // being replaced wholesale. A leaf only one side carries cannot be patched in
  // place; reporting it makes the writer refuse rather than drop the change.
  for (const path of new Set([...collectLeafPaths(baseRoot), ...collectLeafPaths(dbRoot)])) {
    const before = findLeafNode(baseRoot, path);
    const after = findLeafNode(dbRoot, path);
    if (!before || !after) {
      delta.leaves.push(path);
      continue;
    }
    if (stableStringify(before.toJSON()) !== stableStringify(after.toJSON())) {
      delta.leaves.push(path);
    }
  }

  const baseEntities = collectEntities(base);
  const dbEntities = collectEntities(db);

  for (const [id, before] of baseEntities) {
    if (id === baseRootId) {
      continue;
    }
    const after = dbEntities.get(id);
    if (!after) {
      delta.removed.push(id);
      continue;
    }
    if (before.parentId !== after.parentId || before.containerKey !== after.containerKey) {
      // A move is a delete plus an insert; carrying the entity along with it.
      delta.removed.push(id);
      delta.added.push(id);
      continue;
    }
    if (ownContent(before.node) !== ownContent(after.node)) {
      delta.replaced.push(id);
    }
  }
  for (const id of dbEntities.keys()) {
    if (id !== dbRootId && !baseEntities.has(id)) {
      delta.added.push(id);
    }
  }

  // A replaced, removed or added entity carries its descendants with it, so
  // patching those too would splice inside an already replaced range.
  delta.replaced = withoutDescendants(delta.replaced, baseEntities);
  const replaced = new Set(delta.replaced);
  delta.removed = withoutDescendants(delta.removed, baseEntities, replaced);
  delta.added = withoutDescendants(delta.added, dbEntities, replaced);

  return delta;
}

/**
 * `fileContent` with the delta applied, or null when it cannot be applied
 * exactly. A null result means "write nothing": the caller must not fall back
 * to regenerating the file.
 */
export function applyEntityDelta(fileContent: string, dbContent: string, delta: EntityDelta): string | null {
  if (delta.unpatchable) {
    return null;
  }

  let file: Document.Parsed;
  let db: Document.Parsed;
  try {
    file = parseCached(fileContent);
    db = parseCached(dbContent);
  } catch {
    return null;
  }
  if (file.errors.length > 0 || db.errors.length > 0) {
    return null;
  }

  try {
    const fileRoot = asMap(file.contents);
    const dbRoot = asMap(db.contents);
    if (!fileRoot || !dbRoot) {
      return null;
    }

    const fileEntities = collectEntities(file);
    const dbEntities = collectEntities(db);
    const edits: Edit[] = [];

    for (const path of delta.leaves) {
      const before = findLeafNode(fileRoot, path);
      const after = findLeafNode(dbRoot, path);
      if (!after) {
        return null;
      }
      if (!before) {
        const insertion = insertLeaf(fileContent, fileRoot, dbContent, path, after);
        if (!insertion) {
          return null;
        }
        edits.push(insertion);
        continue;
      }
      const range = before.range;
      if (!range) {
        return null;
      }
      // A block scalar's range ends after its last newline; an inline value has
      // none, so replacing one with the other would join two lines.
      const dbText = sourceOf(dbContent, after);
      const fileEndsLine = fileContent[range[1] - 1] === '\n';
      const dbEndsLine = dbText.endsWith('\n');
      const text =
        fileEndsLine && !dbEndsLine
          ? `${dbText}\n`
          : !fileEndsLine && dbEndsLine
            ? dbText.slice(0, -1)
            : dbText;
      edits.push({ start: range[0], end: range[1], text });
    }

    for (const id of delta.replaced) {
      const target = fileEntities.get(id);
      const source = dbEntities.get(id);
      if (!target || !source) {
        return null;
      }
      const targetSpan = blockSpan(fileContent, target.node);
      const sourceSpan = blockSpan(dbContent, source.node);
      edits.push({
        start: targetSpan.start,
        end: targetSpan.end,
        text: reindentBlock(dbContent.slice(sourceSpan.start, sourceSpan.end), sourceSpan.column, targetSpan.column),
      });
    }

    const drops = containerDrops(fileContent, fileRoot, fileEntities, delta, dbEntities);
    for (const id of delta.removed) {
      const target = fileEntities.get(id);
      if (!target) {
        return null;
      }
      const span = blockSpan(fileContent, target.node);
      if (drops.some(drop => span.start >= drop.start && span.end <= drop.end)) {
        continue;
      }
      edits.push({ start: span.start, end: span.end, text: '' });
    }
    edits.push(...drops);

    for (const id of delta.added) {
      const source = dbEntities.get(id);
      if (!source) {
        return null;
      }
      const insertion = insertionFor(fileContent, file, fileEntities, dbContent, dbEntities, source);
      if (!insertion) {
        return null;
      }
      edits.push(insertion);
    }

    return applyEdits(fileContent, edits);
  } catch (err) {
    if (err instanceof EntityDeltaError) {
      return null;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Applies non-overlapping edits back to front so earlier offsets stay valid. */
function applyEdits(content: string, edits: Edit[]): string | null {
  // Insertions at the same offset are prepended one at a time, so the last one
  // applied ends up first: apply them in reverse input order to keep the order
  // the delta lists them in.
  const ordered = edits
    .map((edit, index) => ({ edit, index }))
    .sort((a, b) => b.edit.start - a.edit.start || b.edit.end - a.edit.end || b.index - a.index)
    .map(({ edit }) => edit);
  let out = content;
  let previousStart = Number.POSITIVE_INFINITY;
  for (const edit of ordered) {
    if (edit.end > previousStart) {
      return null;
    }
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    previousStart = edit.start;
  }
  return out;
}

/**
 * The block of a node: from the start of the line it begins on (which carries
 * the indentation and, for a sequence item, the `- ` marker) to the end of its
 * last line. `column` is where the node's own content starts on that first
 * line, so a replacement can be re-indented to match.
 */
function blockSpan(content: string, node: Node): { start: number; end: number; column: number } {
  const span = lineSpan(content, node);
  if (!/^[ \t]*(?:-[ \t]+)?$/.test(content.slice(span.start, span.start + span.column))) {
    // A flow sequence puts siblings on this line: there is no block to replace.
    throw new EntityDeltaError('node is not a block on its own line');
  }
  return span;
}

/** The whole lines a node spans, without requiring anything of what precedes it. */
function lineSpan(content: string, node: Node): { start: number; end: number; column: number } {
  const range = node.range;
  if (!range) {
    throw new EntityDeltaError('node has no range');
  }
  const start = content.lastIndexOf('\n', range[0] - 1) + 1;
  const lastNewline = content.indexOf('\n', Math.max(range[1] - 1, range[0]));
  const end = lastNewline === -1 ? content.length : lastNewline + 1;
  return { start, end, column: range[0] - start };
}

/** Shifts every line so the node's first token moves from `fromColumn` to `toColumn`. */
function reindentBlock(block: string, fromColumn: number, toColumn: number): string {
  const delta = toColumn - fromColumn;
  if (delta === 0) {
    return block;
  }
  return block
    .split('\n')
    .map(line => {
      if (line.trim() === '') {
        return line;
      }
      if (delta > 0) {
        return ' '.repeat(delta) + line;
      }
      const indent = line.length - line.trimStart().length;
      return line.slice(Math.min(indent, -delta));
    })
    .join('\n');
}

function insertionFor(
  fileContent: string,
  file: Document.Parsed,
  fileEntities: Map<string, CollectedEntity>,
  dbContent: string,
  dbEntities: Map<string, CollectedEntity>,
  source: CollectedEntity,
): Edit | null {
  const sourceSpan = blockSpan(dbContent, source.node);
  const block = dbContent.slice(sourceSpan.start, sourceSpan.end);

  const siblings = [...dbEntities.values()]
    .filter(entity => entity.parentId === source.parentId && entity.containerKey === source.containerKey)
    .sort((a, b) => a.index - b.index);

  const position = siblings.findIndex(entity => entity.id === source.id);

  for (let i = position - 1; i >= 0; i--) {
    const sibling = fileEntities.get(siblings[i].id);
    if (sibling) {
      const span = blockSpan(fileContent, sibling.node);
      const text = reindentBlock(block, sourceSpan.column, span.column);
      // A file whose last line has no newline would otherwise get the block glued
      // onto the previous value.
      const needsNewline = span.end > 0 && fileContent[span.end - 1] !== '\n';
      return { start: span.end, end: span.end, text: needsNewline ? `\n${text}` : text };
    }
  }
  for (let i = position + 1; i < siblings.length; i++) {
    const sibling = fileEntities.get(siblings[i].id);
    if (sibling) {
      const span = blockSpan(fileContent, sibling.node);
      return { start: span.start, end: span.start, text: reindentBlock(block, sourceSpan.column, span.column) };
    }
  }

  const parent = source.parentId ? fileEntities.get(source.parentId) : undefined;
  const parentNode = parent?.node ?? asMap(file.contents);
  if (!parentNode || !source.containerKey) {
    return null;
  }

  const existingContainer = pairNode(parentNode, source.containerKey);
  if (isSeq(existingContainer) && existingContainer.items.length > 0) {
    // Nothing to anchor to: append to the end of the container's block.
    const lastItem = existingContainer.items[existingContainer.items.length - 1] as Node;
    const span = blockSpan(fileContent, lastItem);
    const text = reindentBlock(block, sourceSpan.column, span.column);
    const needsNewline = span.end > 0 && fileContent[span.end - 1] !== '\n';
    return { start: span.end, end: span.end, text: needsNewline ? `\n${text}` : text };
  }

  const childColumn = childKeyColumn(fileContent, parentNode);
  if (existingContainer) {
    // `key: []` on one line: turn the empty flow sequence into a block sequence.
    const span = lineSpan(fileContent, existingContainer);
    return {
      start: span.start,
      end: span.end,
      text: `${' '.repeat(childColumn)}${source.containerKey}:\n${reindentBlock(block, sourceSpan.column, childColumn + 4)}`,
    };
  }

  const parentSpan = blockSpan(fileContent, parentNode);
  const needsNewline = parentSpan.end > 0 && fileContent[parentSpan.end - 1] !== '\n';
  return {
    start: parentSpan.end,
    end: parentSpan.end,
    text: `${needsNewline ? '\n' : ''}${' '.repeat(childColumn)}${source.containerKey}:\n${reindentBlock(block, sourceSpan.column, childColumn + 4)}`,
  };
}

/** Column of the first key inside `node`, used to indent a new child key. */
function childKeyColumn(content: string, node: YAMLMap): number {
  const firstKey = node.items.find(pair => pair.key)?.key as Node | undefined;
  if (firstKey?.range) {
    const lineStart = content.lastIndexOf('\n', firstKey.range[0] - 1) + 1;
    return firstKey.range[0] - lineStart;
  }
  return node.range ? blockSpan(content, node).column + 2 : 0;
}

/**
 * A root value the file does not carry: append `key: value` to the end of its
 * parent mapping. Only plain scalars are representable inline; anything else
 * makes the caller refuse.
 */
function insertLeaf(
  content: string,
  root: YAMLMap,
  dbContent: string,
  path: string,
  after: Node,
): Edit | null {
  if (!isScalar(after) || (typeof after.type === 'string' && after.type.startsWith('BLOCK'))) {
    return null;
  }
  const segments = path.split('.');
  const key = segments[segments.length - 1];
  const parentPath = segments.slice(0, -1).join('.');
  const parent = parentPath ? findMapNode(root, parentPath) : root;
  if (!parent) {
    return null;
  }
  const span = blockSpan(content, parent);
  const needsNewline = span.end > 0 && content[span.end - 1] !== '\n';
  return {
    start: span.end,
    end: span.end,
    text: `${needsNewline ? '\n' : ''}${' '.repeat(childKeyColumn(content, parent))}${key}: ${sourceOf(dbContent, after)}\n`,
  };
}

function findMapNode(node: YAMLMap, path: string): YAMLMap | null {
  const [head, ...rest] = path.split('.');
  const value = pairNode(node, head);
  if (!value || !isMap(value)) {
    return null;
  }
  return rest.length === 0 ? (value as YAMLMap) : findMapNode(value as YAMLMap, rest.join('.'));
}

/**
 * When every entity of a `key:` container is removed, drop the container key
 * too, matching what the exporter does with empty containers.
 */
function containerDrops(
  content: string,
  root: YAMLMap,
  entities: Map<string, CollectedEntity>,
  delta: EntityDelta,
  dbEntities: Map<string, CollectedEntity>,
): Edit[] {
  const removed = new Set(delta.removed);
  const receiving = new Set(
    delta.added.map(id => {
      const added = dbEntities.get(id);
      return added?.containerKey ? `${added.parentId}\u0000${added.containerKey}` : '';
    }),
  );
  const seen = new Set<string>();
  const edits: Edit[] = [];

  for (const id of delta.removed) {
    const entity = entities.get(id);
    if (!entity?.containerKey || !entity.parentId) {
      continue;
    }
    const slot = `${entity.parentId}\u0000${entity.containerKey}`;
    if (seen.has(slot) || receiving.has(slot)) {
      continue;
    }
    const parent = entities.get(entity.parentId)?.node ?? root;
    const keyNode = parent.items.find(pair => String(pair.key) === entity.containerKey)?.key as Node | undefined;
    const container = pairNode(parent, entity.containerKey);
    if (!keyNode?.range || !container) {
      continue;
    }
    const allRemoved = isSeq(container)
      ? container.items.length > 0 && container.items.every(item => removed.has(entityIdOf(item as Node) ?? ''))
      : removed.has(entityIdOf(container) ?? '');
    if (!allRemoved) {
      continue;
    }
    seen.add(slot);
    edits.push({
      start: content.lastIndexOf('\n', keyNode.range[0] - 1) + 1,
      end: blockSpan(content, container).end,
      text: '',
    });
  }

  return edits;
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

function collectEntities(doc: Document.Parsed): Map<string, CollectedEntity> {
  const entities = new Map<string, CollectedEntity>();

  const visitEntity = (
    node: YAMLMap,
    parent: CollectedEntity | null,
    containerKey: string | null,
    index: number,
  ): void => {
    const id = entityIdOf(node);
    if (!id || entities.has(id)) {
      return;
    }
    const entity: CollectedEntity = { id, node, parentId: parent?.id ?? null, containerKey, index };
    entities.set(id, entity);
    for (const pair of node.items) {
      visitValue(pair.value as Node | null, entity, String(pair.key));
    }
  };

  const visitValue = (value: Node | null, parent: CollectedEntity | null, containerKey: string | null): void => {
    if (!value) {
      return;
    }
    if (entityIdOf(value)) {
      visitEntity(value as YAMLMap, parent, containerKey, 0);
      return;
    }
    if (isSeq(value)) {
      value.items.forEach((item, index) => {
        if (entityIdOf(item as Node)) {
          visitEntity(item as YAMLMap, parent, containerKey, index);
        } else {
          visitValue(item as Node, parent, containerKey);
        }
      });
      return;
    }
    if (isMap(value)) {
      for (const pair of value.items) {
        visitValue(pair.value as Node | null, parent, String(pair.key));
      }
    }
  };

  const root = asMap(doc.contents);
  if (root && entityIdOf(root)) {
    visitEntity(root, null, null, 0);
  }
  return entities;
}

/** An entity's own content: nested entities are their own delta entries. */
function ownContent(node: YAMLMap): string {
  const content: Record<string, unknown> = {};
  for (const pair of node.items) {
    const value = pair.value as Node | null;
    if (entityIdOf(value) || (isSeq(value) && value.items.some(item => entityIdOf(item as Node)))) {
      continue;
    }
    content[String(pair.key)] = value ? value.toJSON() : null;
  }
  const meta = content.meta;
  if (meta && typeof meta === 'object') {
    for (const key of Object.keys(meta)) {
      if (IMPORT_DERIVED_META_KEYS[key]) {
        delete (meta as Record<string, unknown>)[key];
      }
    }
  }
  return stableStringify(content);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function withoutDescendants(
  ids: string[],
  entities: Map<string, CollectedEntity>,
  alsoGone = new Set<string>(),
): string[] {
  if (ids.length === 0 || (alsoGone.size === 0 && ids.length < 2)) {
    return ids;
  }
  const keep = new Set(ids);
  return ids.filter(id => {
    let parentId = entities.get(id)?.parentId ?? null;
    while (parentId) {
      if (keep.has(parentId) || alsoGone.has(parentId)) {
        return false;
      }
      parentId = entities.get(parentId)?.parentId ?? null;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

function collectLeafPaths(node: YAMLMap, prefix = ''): string[] {
  const paths: string[] = [];
  for (const pair of node.items) {
    const key = String(pair.key);
    const path = prefix ? `${prefix}.${key}` : key;
    if (IMPORT_DERIVED_LEAF_PATHS[path]) {
      continue;
    }
    const value = pair.value as Node | null;
    if (entityIdOf(value)) {
      // An entity (folder, environment, cookie jar, …), handled by the entity delta.
      continue;
    }
    if (isMap(value)) {
      paths.push(...collectLeafPaths(value, path));
      continue;
    }
    if (isSeq(value) && (value.items.length === 0 || value.items.some(item => isMap(item)))) {
      // A container of entities (or an empty one), handled by the entity delta.
      continue;
    }
    paths.push(path);
  }
  return paths;
}

function findLeafNode(node: YAMLMap, path: string): Node | null {
  const [head, ...rest] = path.split('.');
  const value = pairNode(node, head);
  if (!value) {
    return null;
  }
  if (rest.length === 0) {
    return value;
  }
  return isMap(value) ? findLeafNode(value, rest.join('.')) : null;
}

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

function asMap(node: Document.Parsed['contents'] | Node | null | undefined): YAMLMap | null {
  return node && isMap(node) ? (node as YAMLMap) : null;
}

function pairNode(node: YAMLMap, key: string): Node | null {
  return (node.items.find(pair => String(pair.key) === key)?.value as Node | undefined) ?? null;
}

function entityIdOf(node: Node | null | undefined): string | undefined {
  if (!isMap(node)) {
    return undefined;
  }
  const meta = pairNode(node as YAMLMap, 'meta');
  if (!isMap(meta)) {
    return undefined;
  }
  const id = pairNode(meta as YAMLMap, 'id');
  return isScalar(id) && typeof id.value === 'string' ? id.value : undefined;
}

function sourceOf(content: string, node: Node): string {
  const range = node.range;
  if (!range) {
    throw new EntityDeltaError('node has no range');
  }
  return content.slice(range[0], range[1]);
}
