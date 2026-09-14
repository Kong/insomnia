import type { z } from 'zod/v4';

import { deepStrict } from './deep-strict';

export interface SchemaMismatchError {
  path: string;
  code: string;
  message: string;
}

export interface SchemaMismatchResult {
  mismatch: boolean;
  errors: SchemaMismatchError[];
}

function collectIssues(issues: readonly z.core.$ZodIssue[], basePath: PropertyKey[], out: SchemaMismatchError[]) {
  for (const issue of issues) {
    const fullPath = [...basePath, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors.length) {
      issue.errors.forEach(branchIssues => collectIssues(branchIssues, fullPath, out));
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
    console.log(parsedErrorMessage);
    out.push({
      path,
      code,
      message: parsedErrorMessage,
    });
  }
}

export function checkStrictSchemaMatch(schema: z.ZodTypeAny, doc: unknown): SchemaMismatchResult {
  const strictSchema = deepStrict(schema);
  const result = strictSchema.safeParse(doc);
  if (result.success) {
    return { mismatch: false, errors: [] };
  }
  const errors: SchemaMismatchError[] = [];
  console.warn('Failed to parse document', result.error.message);
  collectIssues(result.error.issues, [], errors);
  return { mismatch: errors.length > 0, errors };
}
