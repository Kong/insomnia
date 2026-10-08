import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { FILE_SECTIONS } from './diff-engine';

/**
 * Builds the YAML content for "stage/unstage just this one entity": start from
 * `baseText` (the side that should stay as-is for every other entity) and graft
 * in only `entityId`'s node from `sourceText` (added/replaced/removed), leaving
 * the rest of the tree untouched.
 *
 * Note: the result is produced by parsing both sides into plain objects and
 * re-serializing the whole file, so untouched entities can come out with
 * different (but semantically identical) YAML formatting than the original —
 * the app's own diff/status logic already normalizes past that (see
 * `significant-diff-detection.ts`), but a raw text diff of the result may show
 * cosmetic-only changes outside the staged entity.
 */
export function applyEntityChange(baseText: string, sourceText: string, entityId: string): string {
  const baseFile = safeParse(baseText);
  const sourceFile = safeParse(sourceText);

  if (!baseFile && !sourceFile) {
    return baseText;
  }

  const location = locateEntity(sourceFile, entityId) ?? locateEntity(baseFile, entityId);
  if (!location) {
    return baseText;
  }

  const merged = baseFile ?? {};

  // Backfill file-identity fields so a brand-new (never-committed) file stays
  // valid YAML once the first entity is staged out of it.
  for (const key of ['type', 'schema_version', 'name', 'meta']) {
    if (merged[key] === undefined && sourceFile?.[key] !== undefined) {
      merged[key] = sourceFile[key];
    }
  }

  applyChange(merged, sourceFile ?? {}, entityId, location);

  return stringifyYaml(withSourceKeyOrder(merged, sourceFile));
}

// Orders top-level keys like source (keys only base has keep their place after those), so a
// section newly added to base sits where the app writes it rather than at the end of the file —
// otherwise the staged and working-tree files differ by key order alone.
function withSourceKeyOrder(file: any, sourceFile: any) {
  if (!sourceFile || typeof sourceFile !== 'object') {
    return file;
  }
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(sourceFile)) {
    if (key in file) {
      ordered[key] = file[key];
    }
  }
  for (const key of Object.keys(file)) {
    if (!(key in ordered)) {
      ordered[key] = file[key];
    }
  }
  return ordered;
}

// Parses YAML text into a plain object, returning `undefined` instead of
// throwing when `text` is empty or not valid YAML.
function safeParse(text: string): any {
  if (!text) {
    return undefined;
  }
  try {
    return parseYaml(text);
  } catch {
    return undefined;
  }
}

interface EntityLocation {
  section:
    | 'collection'
    | 'environments-base'
    | 'sub-environment'
    | 'routes'
    | 'mcp-request'
    | 'cookie-jar'
    | 'file-section';
  // ids of ancestor folders, root to the entity's direct parent (collection section only)
  folderPath: string[];
  // top-level keys making up the entity (file-section only)
  keys?: readonly string[];
}

// Recursively searches a collection tree for the node matching `entityId`,
// returning the chain of ancestor folder ids (root-first) it was found under.
function findInCollection(nodes: any[], entityId: string, path: string[]): EntityLocation | null {
  for (const node of nodes ?? []) {
    if (node?.meta?.id === entityId) {
      return { section: 'collection', folderPath: path };
    }
    if (Array.isArray(node?.children)) {
      const found = findInCollection(node.children, entityId, [...path, node.meta?.id]);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Finds which section of a parsed Insomnia v5 file (`collection`,
// `environments`/its sub-environments, `routes`, `mcpRequest`, `cookieJar`)
// an entity id lives in, so `applyChange` knows how to graft it.
function locateEntity(file: any, entityId: string): EntityLocation | null {
  if (!file || typeof file !== 'object') {
    return null;
  }

  const fileSection = FILE_SECTIONS.find(section => section.id === entityId);
  if (fileSection) {
    return fileSection.keys.some(key => file[key] !== undefined)
      ? { section: 'file-section', folderPath: [], keys: fileSection.keys }
      : null;
  }

  if (Array.isArray(file.collection)) {
    const found = findInCollection(file.collection, entityId, []);
    if (found) {
      return found;
    }
  }

  if (file.environments) {
    if (file.environments.meta?.id === entityId) {
      return { section: 'environments-base', folderPath: [] };
    }
    if ((file.environments.subEnvironments ?? []).some((env: any) => env?.meta?.id === entityId)) {
      return { section: 'sub-environment', folderPath: [] };
    }
  }

  if (Array.isArray(file.routes) && file.routes.some((route: any) => route?.meta?.id === entityId)) {
    return { section: 'routes', folderPath: [] };
  }

  if (file.mcpRequest?.meta?.id === entityId) {
    return { section: 'mcp-request', folderPath: [] };
  }

  if (file.cookieJar && (file.cookieJar.meta?.id ?? 'cookie-jar') === entityId) {
    return { section: 'cookie-jar', folderPath: [] };
  }

  return null;
}

// Replaces/inserts/removes the entry matching `entityId` in `baseArray`, using
// `sourceArray`'s version of it (or its absence, for removal).
function spliceById(baseArray: any[] = [], sourceArray: any[] = [], entityId: string): any[] {
  const result = [...(baseArray ?? [])];
  const sourceIndex = (sourceArray ?? []).findIndex(item => item?.meta?.id === entityId);
  const baseIndex = result.findIndex(item => item?.meta?.id === entityId);

  if (sourceIndex === -1) {
    if (baseIndex !== -1) {
      result.splice(baseIndex, 1);
    }
    return result;
  }

  const sourceItem = sourceArray[sourceIndex];
  if (baseIndex === -1) {
    const insertAt = Math.min(sourceIndex, result.length);
    result.splice(insertAt, 0, sourceItem);
  } else {
    result[baseIndex] = sourceItem;
  }
  return result;
}

// Finds the node with `id` anywhere in a collection tree, along with the array
// that contains it.
function findNodeWithContainer(nodes: any[], id: string): { node: any; container: any[] } | null {
  for (const node of nodes ?? []) {
    if (node?.meta?.id === id) {
      return { node, container: nodes };
    }
    if (Array.isArray(node?.children)) {
      const found = findNodeWithContainer(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Returns the children array found by walking `folderPath` (root-first folder ids) down a collection tree.
function childrenAtPath(collection: any[], folderPath: string[]): any[] {
  let nodes: any[] = Array.isArray(collection) ? collection : [];
  for (const folderId of folderPath) {
    nodes = nodes.find((node: any) => node?.meta?.id === folderId)?.children ?? [];
  }
  return nodes;
}

// Resolves the base-tree array a source entity at `folderPath` should be grafted
// into. The deepest ancestor that already exists in base is reused wherever it
// currently sits (it may have been moved in source — duplicating it would leave
// two folders with the same id); any deeper ancestors missing from base are
// created as shells cloned from source with empty children, otherwise there'd
// be nowhere to graft a newly-added nested entity into.
function descendToContainer(baseFile: any, sourceFile: any, folderPath: string[]): { container: any[]; sourceArray: any[] } {
  if (!Array.isArray(baseFile.collection)) {
    baseFile.collection = [];
  }
  const sourceCollection = Array.isArray(sourceFile.collection) ? sourceFile.collection : [];

  let container: any[] = baseFile.collection;
  let depth = 0;
  for (let i = folderPath.length; i > 0; i--) {
    const existing = findNodeWithContainer(baseFile.collection, folderPath[i - 1]);
    if (existing) {
      if (!Array.isArray(existing.node.children)) {
        existing.node.children = [];
      }
      container = existing.node.children;
      depth = i;
      break;
    }
  }

  let sourceArray = childrenAtPath(sourceCollection, folderPath.slice(0, depth));
  for (const folderId of folderPath.slice(depth)) {
    const sourceIndex = sourceArray.findIndex((node: any) => node?.meta?.id === folderId);
    const sourceFolderNode = sourceArray[sourceIndex];
    const shell = sourceFolderNode
      ? { ...sourceFolderNode, children: [] }
      : { meta: { id: folderId }, name: 'Untitled Folder', children: [] };
    container.splice(sourceIndex === -1 ? container.length : Math.min(sourceIndex, container.length), 0, shell);
    container = shell.children;
    sourceArray = sourceFolderNode?.children ?? [];
  }

  return { container, sourceArray };
}

// Grafts a collection-tree entity (request or folder) from source into base,
// wherever source has it — moving it if it sits elsewhere in base, and removing
// it if source no longer has it. A folder only carries its own fields: its
// `children` are separate entities, so base's children are kept as-is.
function applyCollectionChange(baseFile: any, sourceFile: any, entityId: string) {
  if (!Array.isArray(baseFile.collection)) {
    baseFile.collection = [];
  }

  const existing = findNodeWithContainer(baseFile.collection, entityId);
  let existingIndex = -1;
  if (existing) {
    existingIndex = existing.container.indexOf(existing.node);
    existing.container.splice(existingIndex, 1);
  }

  const sourceLocation = findInCollection(sourceFile.collection, entityId, []);
  if (!sourceLocation) {
    return;
  }

  const { container, sourceArray } = descendToContainer(baseFile, sourceFile, sourceLocation.folderPath);
  const sourceIndex = sourceArray.findIndex((node: any) => node?.meta?.id === entityId);
  const sourceNode = sourceArray[sourceIndex];
  const node = Array.isArray(sourceNode.children) ? { ...sourceNode, children: existing?.node?.children ?? [] } : sourceNode;

  // Staying in the same container keeps its original position to avoid reorder noise.
  const insertAt = existing?.container === container ? existingIndex : Math.min(sourceIndex, container.length);
  container.splice(insertAt, 0, node);
}

// Mutates `baseFile` in place, grafting `entityId`'s version from
// `sourceFile` into the section `location` points at (or removing it, if
// `sourceFile` no longer has it) — one branch per `EntityLocation.section`.
function applyChange(baseFile: any, sourceFile: any, entityId: string, location: EntityLocation) {
  switch (location.section) {
    case 'collection': {
      applyCollectionChange(baseFile, sourceFile, entityId);
      return;
    }
    case 'environments-base': {
      // The base environment is the container of the sub-environments, so
      // removing it removes them too.
      if (!sourceFile.environments) {
        delete baseFile.environments;
        return;
      }
      const sourceEnv = sourceFile.environments;
      const baseEnv = baseFile.environments ?? {};
      // Take every field from source — including dropping fields source doesn't
      // have (eg. `data` added in base but absent in source), which a plain
      // spread would silently keep. Base key order is kept to avoid YAML noise.
      const merged: Record<string, unknown> = {};
      for (const key of new Set([...Object.keys(baseEnv), ...Object.keys(sourceEnv)])) {
        // Sub-environments are staged as their own entities — don't let a base
        // environment stage pull in unrelated sub-environment changes.
        const value = key === 'subEnvironments' ? baseEnv[key] : sourceEnv[key];
        if (value !== undefined) {
          merged[key] = value;
        }
      }
      baseFile.environments = merged;
      return;
    }
    case 'sub-environment': {
      if (!baseFile.environments) {
        baseFile.environments = sourceFile.environments ? { ...sourceFile.environments, subEnvironments: [] } : { subEnvironments: [] };
      }
      if (!Array.isArray(baseFile.environments.subEnvironments)) {
        baseFile.environments.subEnvironments = [];
      }
      const sourceSubs = sourceFile.environments?.subEnvironments ?? [];
      baseFile.environments.subEnvironments = spliceById(baseFile.environments.subEnvironments, sourceSubs, entityId);
      return;
    }
    case 'routes': {
      baseFile.routes = spliceById(baseFile.routes ?? [], sourceFile.routes ?? [], entityId);
      return;
    }
    case 'mcp-request': {
      baseFile.mcpRequest = sourceFile.mcpRequest;
      return;
    }
    case 'cookie-jar': {
      baseFile.cookieJar = sourceFile.cookieJar;
      return;
    }
    case 'file-section': {
      // A file-level section is taken from source as a whole, key by key.
      for (const key of location.keys ?? []) {
        if (sourceFile[key] === undefined) {
          delete baseFile[key];
        } else {
          baseFile[key] = sourceFile[key];
        }
      }
      return;
    }
    default: {
      return;
    }
  }
}
