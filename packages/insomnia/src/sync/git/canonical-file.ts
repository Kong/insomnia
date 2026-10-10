/**
 * Predicts what the Git Sync pipeline writes back to disk for a given Insomnia YAML file.
 *
 * After a discard, RepoFileWatcher imports the restored file into the DB and then
 * re-exports the workspace to disk. When the restored file is not in the exact format
 * Insomnia generates (e.g. it was edited by hand or by an older version), the re-export
 * differs from it and the file shows up as changed again, so the change can never be
 * discarded. This module replays that import → export round-trip in memory, without
 * touching the DB, so such files can be detected up front.
 */

import type { AllTypes, BaseModel, Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';
import { initModel } from 'insomnia-data/node';

import { MODELS_BY_EXPORT_TYPE } from '~/common/import';
import { InsomniaFileTypeValues } from '~/common/import-v5-parser';
import { serializeInsomniaV5Export, tryImportV5Data } from '~/common/insomnia-v5';

function compareValues(a: string | number, b: string | number) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Orders docs exactly like `database.getWithDescendants`: breadth-first, level by level,
 * grouped by descendant type within a level, and sorted by `created` within a type.
 * NeDB has no `parentId` index, so it reads candidates in `_id` order and its stable
 * sort leaves docs with an equal `created` in `_id` order.
 */
function orderLikeGetWithDescendants(root: BaseModel, docs: BaseModel[], types: AllTypes[]) {
  const descendantMap = models.generateDescendantMap(types);
  const ordered: BaseModel[] = [root];
  let level: BaseModel[] = [root];

  while (level.length > 0) {
    const parentIdsByType = new Map<AllTypes, Set<string>>();
    for (const parent of level) {
      for (const type of descendantMap[parent.type] ?? []) {
        const parentIds = parentIdsByType.get(type) ?? new Set<string>();
        parentIds.add(parent._id);
        parentIdsByType.set(type, parentIds);
      }
    }

    const nextLevel: BaseModel[] = [];
    for (const [type, parentIds] of parentIdsByType) {
      const children = docs
        .filter(doc => doc.type === type && parentIds.has(doc.parentId))
        .sort((a, b) => compareValues(a.created, b.created) || compareValues(a._id, b._id));
      nextLevel.push(...children);
    }

    ordered.push(...nextLevel);
    level = nextLevel;
  }

  return ordered;
}

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
  if (error || !data?.length) {
    return null;
  }

  // Mirror `database.update`, which initializes every doc and upserts it by _id (last write wins)
  const docsById = new Map<string, BaseModel>();
  for (const doc of data) {
    const initializedDoc = await initModel<BaseModel>(doc.type, doc);
    docsById.set(initializedDoc._id, initializedDoc);
  }
  const docs = [...docsById.values()];

  const workspace = docs.find(models.workspace.isWorkspace) as Workspace | undefined;
  if (!workspace) {
    return null;
  }

  const exportedContent = serializeInsomniaV5Export({
    workspace,
    workspaceDescendants: orderLikeGetWithDescendants(workspace, docs, Object.values(MODELS_BY_EXPORT_TYPE)),
    includePrivateEnvironments: false,
  });

  return exportedContent || null;
}

/**
 * Whether the whole difference between the committed and working copy of a file comes from
 * Insomnia re-generating the committed file. Such a change reappears after every discard and
 * can only be resolved by committing it.
 */
export async function isUndiscardableChange({
  committedContent,
  workingCopyContent,
}: {
  committedContent: string | null;
  workingCopyContent: string | null;
}) {
  if (!committedContent || !workingCopyContent || committedContent === workingCopyContent) {
    return false;
  }

  const canonicalContent = await getCanonicalInsomniaFileContent(committedContent);
  return canonicalContent !== null && canonicalContent !== committedContent && canonicalContent === workingCopyContent;
}
