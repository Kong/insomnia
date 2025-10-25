import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'Comparison Result';
export const type = 'ComparisonResult';
export const prefix = 'compres';
export const canDuplicate = false;
export const canSync = false;

export interface DiffResult {
  path: string;
  sourceValue: any;
  targetValue: any;
  type: 'added' | 'removed' | 'modified';
  severity: 'critical' | 'warning' | 'info';
}

export interface HeaderDiff {
  name: string;
  sourceValue?: string;
  targetValue?: string;
  type: 'added' | 'removed' | 'modified';
}

export interface ComparisonSummary {
  totalDifferences: number;
  criticalDifferences: number;
  warningDifferences: number;
  statusCodeMatch: boolean;
  responseTimeSource: number;
  responseTimeTarget: number;
  responseTimePercentDiff: number;
  responseSizeSource: number;
  responseSizeTarget: number;
  responseSizePercentDiff: number;
  matchPercentage: number;
}

export interface BaseComparisonResult {
  environmentComparisonId: string;
  requestId: string;
  requestName: string;
  sourceResponseId: string;
  targetResponseId: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  bodyDifferences: DiffResult[];
  headerDifferences: HeaderDiff[];
  summary: ComparisonSummary;
  executedAt: number;
  sourceStatusCode: number;
  targetStatusCode: number;
  sourceUrl: string;
  targetUrl: string;
}

export type ComparisonResult = BaseModel & BaseComparisonResult;

export const isComparisonResult = (model: Pick<BaseModel, 'type'>): model is ComparisonResult =>
  model.type === type;

export function init(): BaseComparisonResult {
  return {
    environmentComparisonId: '',
    requestId: '',
    requestName: '',
    sourceResponseId: '',
    targetResponseId: '',
    sourceEnvironmentId: '',
    targetEnvironmentId: '',
    bodyDifferences: [],
    headerDifferences: [],
    summary: {
      totalDifferences: 0,
      criticalDifferences: 0,
      warningDifferences: 0,
      statusCodeMatch: true,
      responseTimeSource: 0,
      responseTimeTarget: 0,
      responseTimePercentDiff: 0,
      responseSizeSource: 0,
      responseSizeTarget: 0,
      responseSizePercentDiff: 0,
      matchPercentage: 100,
    },
    executedAt: Date.now(),
    sourceStatusCode: 0,
    targetStatusCode: 0,
    sourceUrl: '',
    targetUrl: '',
  };
}

export function migrate(doc: ComparisonResult): ComparisonResult {
  return doc;
}

export function create(patch: Partial<ComparisonResult> = {}) {
  if (!patch.parentId) {
    throw new Error(`New Comparison Result missing \`parentId\`: ${JSON.stringify(patch)}`);
  }
  return db.docCreate<ComparisonResult>(type, patch);
}

export function getById(id: string): Promise<ComparisonResult | null> {
  return db.get(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<ComparisonResult>(type, { parentId });
}

export function findByEnvironmentComparison(environmentComparisonId: string) {
  return db.find<ComparisonResult>(type, { environmentComparisonId });
}

export function remove(comparisonResult: ComparisonResult) {
  return db.remove(comparisonResult);
}

export async function removeForEnvironmentComparison(environmentComparisonId: string) {
  const results = await findByEnvironmentComparison(environmentComparisonId);
  await Promise.all(results.map(result => remove(result)));
}

export function all() {
  return db.all<ComparisonResult>(type);
}
