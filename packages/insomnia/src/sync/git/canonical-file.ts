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
 * Whether the whole difference between the committed and working copy of a file comes from
 * Insomnia re-generating the committed file. Such a change reappears after every discard and
 * can only be resolved by committing it.
 */
export async function isUndiscardableChange({
  filepath,
  committedContent,
  workingCopyContent,
}: {
  filepath: string;
  committedContent: string | null;
  workingCopyContent: string | null;
}) {
  if (!committedContent || !workingCopyContent || committedContent === workingCopyContent) {
    return false;
  }

  const canonicalContent = await getCanonicalInsomniaFileContent(committedContent);
  if (canonicalContent === null || canonicalContent === committedContent) {
    return false;
  }

  // Compare with the same rules the Unstaged changes list uses. Import fills missing
  // `meta.created`/`modified` with the current time, so the replay and the working copy can
  // differ in those alone even though both come from re-generating the same committed file.
  return !hasSignificantChanges(canonicalContent, workingCopyContent, filepath);
}
