/**
 * Replays the Git Sync import → export round-trip for a file: what Insomnia
 * would write for a given YAML file, and how the file on disk differs from
 * that.
 *
 * The DB→FS writer takes the base of the file on disk from it and verifies its
 * patch against it (see entity-delta.ts). The visual diff uses it to splice one
 * entity into the file on disk and replay the result.
 */

import { models } from 'insomnia-data';
import { createNedbDatabase } from 'insomnia-data/node';
import { parse } from 'yaml';

import { InsomniaFileTypeValues } from '~/common/import-v5-parser';
import { getInsomniaV5DataExport, tryImportV5Data } from '~/common/insomnia-v5';

/**
 * Returns the content the Git Sync pipeline would write to disk after importing `content`,
 * or null if `content` is not an importable Insomnia file.
 */
export async function getCanonicalInsomniaFileContent(content: string): Promise<string | null> {
  if (!isInsomniaFileContent(content)) {
    return null;
  }

  const { data, error } = tryImportV5Data(content);
  const workspace = data.find(models.workspace.isWorkspace);
  if (error || !workspace) {
    return null;
  }

  // A separate instance with its own collections. It must not go through `initDatabase`,
  // which would replace the app database.
  const scratchDb = createNedbDatabase();
  await scratchDb.init({ inMemoryOnly: true });

  // Same writes as RepoFileWatcher.upsertDocs
  for (const doc of data) {
    await scratchDb.update(doc);
  }

  const exportedContent = await getInsomniaV5DataExport({
    workspaceId: workspace._id,
    includePrivateEnvironments: false,
    db: scratchDb,
  });

  return exportedContent || null;
}

// Whether `content` declares itself an Insomnia file on its first line (eg. `type: collection.insomnia.rest/5.0`).
function isInsomniaFileContent(content: string) {
  const newLineIndex = content.indexOf('\n');
  const firstLine = (newLineIndex === -1 ? content : content.slice(0, newLineIndex)).trim();
  return InsomniaFileTypeValues.some(type => firstLine.includes(type));
}

export type InsomniaFileFormatIssue = 'invalid' | 'non-canonical';

/**
 * How `content` differs from a file Insomnia writes itself: `invalid` when it's an Insomnia file that
 * doesn't match the file format, `non-canonical` when it does but Insomnia would write it differently
 * (eg. it was edited by hand — comments, formatting, order, missing or duplicated parts, unrecognized
 * fields — or written by another version of Insomnia), and null when it's exactly what Insomnia writes,
 * empty, or not an Insomnia file at all.
 */
export async function getInsomniaFileFormatIssue(content: string | null): Promise<InsomniaFileFormatIssue | null> {
  if (!content || !isInsomniaFileContent(content)) {
    return null;
  }
  if (tryImportV5Data(content).error) {
    return 'invalid';
  }
  return (await getCanonicalInsomniaFileContent(content)) === content ? null : 'non-canonical';
}

/**
 * `content` as the Git Sync pipeline would write it, or `content` itself when it can't be replayed
 * (not an importable Insomnia file, or a workspace the export can't produce, e.g. a file without a
 * base environment) or the replay adds entities `content` doesn't have.
 * For files assembled outside the export, like the visual diff's per-entity stage/discard that splices
 * one entity into a file: replaying them gives the export's key order, entity order and dropped empty
 * values, so the result doesn't differ from what Insomnia writes in ways no entity accounts for.
 */
export async function canonicalizeInsomniaFileContent(content: string): Promise<string> {
  try {
    const canonicalContent = await getCanonicalInsomniaFileContent(content);
    // The import fills in what a file is missing, eg. a `__MOCK_SERVER_ID__` server for a mock file
    // whose server was spliced out. Writing that would add an entity nobody added, so keep `content`.
    if (canonicalContent === null || hasEntityIdsNotIn(canonicalContent, content)) {
      return content;
    }
    return canonicalContent;
  } catch (err) {
    console.warn('[git] Failed to canonicalize Insomnia file content', err);
    return content;
  }
}

function hasEntityIdsNotIn(content: string, originalContent: string) {
  const originalIds = collectMetaIds(parse(originalContent));
  return [...collectMetaIds(parse(content))].some(id => !originalIds.has(id));
}

// Every `meta.id` in a parsed Insomnia file, at any depth
function collectMetaIds(value: unknown, ids = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach(item => collectMetaIds(item, ids));
  } else if (value && typeof value === 'object') {
    const { meta } = value as { meta?: { id?: unknown } };
    if (typeof meta?.id === 'string') {
      ids.add(meta.id);
    }
    Object.values(value).forEach(item => collectMetaIds(item, ids));
  }
  return ids;
}
