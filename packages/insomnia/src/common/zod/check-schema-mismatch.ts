import type { z } from 'zod/v4';

import { deepStrict } from './deep-strict';

export interface SchemaMismatchError {
  path: string;
  // The same path as `path`, but as segments, so callers can locate the node in the source document.
  pathSegments: PropertyKey[];
  code: string;
  message: string;
  // Only set for `unrecognized_keys` issues: the unknown keys found on the object at `pathSegments`.
  keys?: string[];
}

export interface SchemaMismatchResult {
  mismatch: boolean;
  errors: SchemaMismatchError[];
}

interface IssueScore {
  // Issues that are NOT unknown keys, i.e. evidence that the document does not belong to this union branch.
  foreign: number;
  // How many keys the branch reports as unknown: a branch that recognizes none of the document's fields reports all of
  // them, which is much weaker evidence of a real mismatch than a branch that reports a single key.
  keys: number;
  total: number;
}

function scoreIssues(issues: readonly z.core.$ZodIssue[]): IssueScore {
  const score: IssueScore = { foreign: 0, keys: 0, total: 0 };
  for (const issue of issues) {
    let issueScore: IssueScore;
    if (issue.code === 'invalid_union' && issue.errors.length) {
      issueScore = pickBestBranch(issue.errors).score;
    } else if ((issue.code === 'invalid_key' || issue.code === 'invalid_element') && issue.issues.length) {
      issueScore = scoreIssues(issue.issues);
    } else if (issue.code === 'unrecognized_keys') {
      issueScore = { foreign: 0, keys: issue.keys.length, total: 1 };
    } else {
      issueScore = { foreign: 1, keys: 0, total: 1 };
    }
    score.foreign += issueScore.foreign;
    score.keys += issueScore.keys;
    score.total += issueScore.total;
  }
  return score;
}

// NOTE: for a `z.union` zod reports the issues of *every* branch, so the real mismatch is buried in noise from the branches the value does not belong to.
// RequestCollectionSchema (the `collection` of CollectionSchema) has no discriminator at all  so an entry in it drags in 4 foreign branches.
// Even a union whose branches are discriminated can report noise: AuthenticationSchema is `z.union([z.discriminatedUnion('type', [...]),
// z.object({})])`, and the empty fallback object reports *every* field of an auth block as unknown.
// Finding the real mismatch therefore means finding the branch the value actually belongs to: the document already
// passes the non-strict schema, so that branch is the one whose only issues are unknown keys and the one reporting the fewest unknown keys and
// finally the one with the fewest issues overall.
// This can be avoided after we add new `type` field and change to use discriminated unions for RequestCollectionSchema
function pickBestBranch(branches: readonly (readonly z.core.$ZodIssue[])[]) {
  const isBetter = (score: IssueScore, best: IssueScore) =>
    score.foreign !== best.foreign
      ? score.foreign < best.foreign
      : score.keys !== best.keys
        ? score.keys < best.keys
        : score.total < best.total;

  let best = { issues: branches[0], score: scoreIssues(branches[0]) };
  for (const issues of branches.slice(1)) {
    const score = scoreIssues(issues);
    if (isBetter(score, best.score)) {
      best = { issues, score };
    }
  }
  return best;
}

function collectIssues(issues: readonly z.core.$ZodIssue[], basePath: PropertyKey[], out: SchemaMismatchError[]) {
  for (const issue of issues) {
    const fullPath = [...basePath, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors.length) {
      collectIssues(pickBestBranch(issue.errors).issues, fullPath, out);
      continue;
    }
    if ((issue.code === 'invalid_key' || issue.code === 'invalid_element') && issue.issues.length) {
      collectIssues(issue.issues, fullPath, out);
      continue;
    }
    const path = fullPath.length ? fullPath.join('.') : 'root';
    const code = issue.code ?? 'unknown';
    const issueMessage = issue.message ?? 'unknown cause';
    const parsedErrorMessage = `Parse document error: ${issueMessage} at path ${path}`;
    out.push({
      path,
      pathSegments: fullPath,
      code,
      message: parsedErrorMessage,
      ...(issue.code === 'unrecognized_keys' ? { keys: issue.keys } : {}),
    });
  }
}

// cache the strict schema to avoid rebuilding it multiple times
const strictSchemaCache = new WeakMap<z.ZodTypeAny, z.ZodTypeAny>();

export function getStrictSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let strictSchema = strictSchemaCache.get(schema);
  if (!strictSchema) {
    strictSchema = deepStrict(schema);
    strictSchemaCache.set(schema, strictSchema);
  }
  return strictSchema;
}

// Checks if a document strictly matches a Zod schema and collects detailed mismatch errors.
export function checkStrictSchemaMatch(schema: z.ZodTypeAny, doc: unknown): SchemaMismatchResult {
  const result = getStrictSchema(schema).safeParse(doc);
  if (result.success) {
    return { mismatch: false, errors: [] };
  }
  const errors: SchemaMismatchError[] = [];
  console.warn('Failed to parse document', result.error.message);
  collectIssues(result.error.issues, [], errors);
  return { mismatch: errors.length > 0, errors };
}
