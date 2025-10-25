import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Environment Comparison';
export const type = 'EnvironmentComparison';
export const prefix = 'envcomp';
export const canDuplicate = true;
export const canSync = true;

/**
 * Configuration options for customizing response comparison behavior.
 * Controls which fields/headers to ignore and tolerance levels for numeric differences.
 */
export interface ComparisonConfig {
  ignoreFields: string[];
  tolerancePercent: number;
  ignoreHeaders: string[];
  compareResponseTime: boolean;
  responseSizeTolerance: number;
  caseSensitive: boolean;
}

/**
 * Represents a configured environment comparison that can be run multiple times.
 * Stores source/target environment IDs, selected requests, and comparison rules.
 */
export interface BaseEnvironmentComparison {
  name: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  requestIds: string[];
  comparisonRules: ComparisonConfig;
  lastExecuted: number | null;
  description: string;
}

export type EnvironmentComparison = BaseModel & BaseEnvironmentComparison;

export const isEnvironmentComparison = (model: Pick<BaseModel, 'type'>): model is EnvironmentComparison =>
  model.type === type;

export function init(): BaseEnvironmentComparison {
  return {
    name: 'New Environment Comparison',
    sourceEnvironmentId: '',
    targetEnvironmentId: '',
    requestIds: [],
    comparisonRules: {
      ignoreFields: [],
      tolerancePercent: 0,
      ignoreHeaders: ['date', 'server', 'x-request-id'],
      compareResponseTime: true,
      responseSizeTolerance: 0,
      caseSensitive: true,
    },
    lastExecuted: null,
    description: '',
  };
}

export function migrate(doc: EnvironmentComparison): EnvironmentComparison {
  return doc;
}

export function create(patch: Partial<EnvironmentComparison> = {}) {
  if (!patch.parentId) {
    throw new Error(`New Environment Comparison missing \`parentId\`: ${JSON.stringify(patch)}`);
  }
  return db.docCreate<EnvironmentComparison>(type, patch);
}

export function update(environmentComparison: EnvironmentComparison, patch: Partial<EnvironmentComparison>) {
  return db.docUpdate(environmentComparison, patch);
}

export function getById(id: string): Promise<EnvironmentComparison | null> {
  return db.get(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<EnvironmentComparison>(type, { parentId });
}

export async function duplicate(environmentComparison: EnvironmentComparison) {
  const name = `${environmentComparison.name} (Copy)`;
  return db.duplicate(environmentComparison, { name });
}

export function remove(environmentComparison: EnvironmentComparison) {
  return db.remove(environmentComparison);
}

export function all() {
  return db.all<EnvironmentComparison>(type);
}
