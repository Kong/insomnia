/**
 * Predicts what the Git Sync pipeline writes back to disk for a given Insomnia YAML file.
 *
 * After a discard, RepoFileWatcher imports the restored file into the DB and then
 * re-exports the workspace to disk. When the restored file is not in the exact format
 * Insomnia generates (e.g. it was edited by hand or by an older version), the re-export
 * differs from it and the file shows up as changed again, so the change can never be
 * discarded. This module replays that import → export round-trip against a scratch
 * in-memory database, so such files can be detected up front without touching app data.
 */

import { models } from 'insomnia-data';
import { createNedbDatabase } from 'insomnia-data/node';
import { parse } from 'yaml';

import { InsomniaFileTypeValues } from '~/common/import-v5-parser';
import { getInsomniaV5DataExport, tryImportV5Data } from '~/common/insomnia-v5';
import { hasSignificantChanges } from '~/common/significant-diff-detection';

/**
 * Returns the content the Git Sync pipeline would write to disk after importing `content`,
 * or null if `content` is not an importable Insomnia file.
 */
export async function getCanonicalInsomniaFileContent(content: string): Promise<string | null> {
  const newLineIndex = content.indexOf('\n');
  const firstLine = (newLineIndex === -1 ? content : content.slice(0, newLineIndex)).trim();
  if (!InsomniaFileTypeValues.some(type => firstLine.includes(type))) {
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

/**
 * Whether the whole difference between the baseline and working copy of a file comes from
 * Insomnia re-generating the baseline. The baseline is what a discard restores: the staged
 * content, or the HEAD content when nothing is staged. Such a change reappears after every
 * discard and can only be resolved by committing it.
 */
export async function isUndiscardableChange({
  filepath,
  baselineContent,
  workingCopyContent,
}: {
  filepath: string;
  baselineContent: string | null;
  workingCopyContent: string | null;
}) {
  if (!baselineContent || !workingCopyContent || baselineContent === workingCopyContent) {
    return false;
  }

  const canonicalContent = await getCanonicalInsomniaFileContent(baselineContent);
  if (canonicalContent === null || canonicalContent === baselineContent) {
    return false;
  }

  // Compare with the same rules the Unstaged changes list uses. Import fills missing
  // `meta.created`/`modified` with the current time, so the replay and the working copy can
  // differ in those alone even though both come from re-generating the same baseline.
  return !hasSignificantChanges(canonicalContent, workingCopyContent, filepath);
}
