import type { ProjectLintRuleset } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.projectLintRuleset;

export function getByParentId(projectId: string) {
  return db.findOne<ProjectLintRuleset>(type, { parentId: projectId });
}

export async function upsert(projectId: string, patch: Partial<ProjectLintRuleset> = {}) {
  const existing = await db.findOne<ProjectLintRuleset>(type, {
    parentId: projectId,
  });

  if (!existing) {
    return db.docCreate<ProjectLintRuleset>(type, { ...patch, parentId: projectId });
  }

  return db.docUpdate(existing, patch);
}

export function remove(projectId: string) {
  return db.removeWhere(type, { parentId: projectId });
}
