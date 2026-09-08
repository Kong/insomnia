import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

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

  return stringifyYaml(merged);
}

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
  section: 'collection' | 'environments-base' | 'sub-environment' | 'routes' | 'mcp-request' | 'cookie-jar';
  // ids of ancestor folders, root to the entity's direct parent (collection section only)
  folderPath: string[];
}

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

function locateEntity(file: any, entityId: string): EntityLocation | null {
  if (!file || typeof file !== 'object') {
    return null;
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

// Walks `folderPath` inside the base tree being mutated, creating minimal
// folder shells (cloned from the source tree, with empty children) for any
// ancestor that doesn't exist in base yet — otherwise there'd be nowhere to
// graft a newly-added nested entity into.
function descendToContainer(baseFile: any, sourceFile: any, folderPath: string[]): { parent: any; key: string; sourceArray: any[] } {
  if (!Array.isArray(baseFile.collection)) {
    baseFile.collection = [];
  }
  let parent: any = baseFile;
  let key = 'collection';
  let sourceArray: any[] = Array.isArray(sourceFile.collection) ? sourceFile.collection : [];

  for (const folderId of folderPath) {
    const baseArray: any[] = parent[key];
    let folderNode = baseArray.find((node: any) => node?.meta?.id === folderId);
    const sourceFolderNode = sourceArray.find((node: any) => node?.meta?.id === folderId);

    if (!folderNode) {
      const shell = sourceFolderNode
        ? { ...sourceFolderNode, children: [] }
        : { meta: { id: folderId }, name: 'Untitled Folder', children: [] };
      const sourceIndex = sourceArray.findIndex((node: any) => node?.meta?.id === folderId);
      const insertAt = sourceIndex === -1 ? baseArray.length : Math.min(sourceIndex, baseArray.length);
      baseArray.splice(insertAt, 0, shell);
      folderNode = shell;
    }
    if (!Array.isArray(folderNode.children)) {
      folderNode.children = [];
    }

    parent = folderNode;
    key = 'children';
    sourceArray = sourceFolderNode?.children ?? [];
  }

  return { parent, key, sourceArray };
}

function applyChange(baseFile: any, sourceFile: any, entityId: string, location: EntityLocation) {
  switch (location.section) {
    case 'collection': {
      const { parent, key, sourceArray } = descendToContainer(baseFile, sourceFile, location.folderPath);
      parent[key] = spliceById(parent[key], sourceArray, entityId);
      return;
    }
    case 'environments-base': {
      const sourceEnv = sourceFile.environments ?? {};
      const baseEnv = baseFile.environments ?? {};
      baseFile.environments = {
        ...baseEnv,
        ...sourceEnv,
        // Sub-environments are staged as their own entities — don't let a base
        // environment stage pull in unrelated sub-environment changes.
        subEnvironments: baseEnv.subEnvironments,
      };
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
    default: {
      return;
    }
  }
}
