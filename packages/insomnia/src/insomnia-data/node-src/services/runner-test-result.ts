import { database as db, models, type RunnerTestResult } from '~/insomnia-data';

const { type } = models.runnerTestResult;

export function create(patch: Partial<RunnerTestResult> = {}) {
  if (!patch.parentId) {
    throw new Error('New RunnerTestResult missing `parentId` ' + JSON.stringify(patch));
  }

  return db.docCreate(type, patch);
}

export function update(testResult: RunnerTestResult, patch: Partial<RunnerTestResult>) {
  return db.docUpdate(testResult, patch);
}

export function getByParentId(parentId: string) {
  return db.findOne<RunnerTestResult>(type, { parentId });
}

export function getById(_id: string) {
  return db.findOne<RunnerTestResult>(type, {
    _id,
  });
}

export function all() {
  return db.find<RunnerTestResult>(type);
}

export function remove(item: RunnerTestResult) {
  return db.remove<RunnerTestResult>(item);
}

export function findByParentId(parentId: string) {
  return db.find<RunnerTestResult>(type, { parentId: parentId });
}
