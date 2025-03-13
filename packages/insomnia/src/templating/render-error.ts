import { get as _get } from 'lodash';

import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { getBodyBuffer, getLatestForRequest } from '../models/response';
import type { Workspace } from '../models/workspace';
export class RenderError extends Error {
  // TODO: unsound definite assignment assertions
  // This is easy to fix, but be careful: extending from Error has especially tricky behavior.
  message!: string;
  path!: string | null;
  location!: {
    line: number;
    column: number;
  };

  type!: string;
  reason!: string;
  extraInfo?: { subType: 'environmentVariable'; undefinedEnvironmentVariables: string[] };

  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

// because nunjucks only report the first error, we need to extract all missing variables that are not present in the context
// for example, if the text is `{{ a }} {{ b }}`, nunjucks only report `a` is missing, but we need to report both `a` and `b`
export function extractUndefinedVariableKey(text: string = '', templatingContext: Record<string, any>): string[] {
  const regexVariable = /{{\s*([^ }]+)\s*}}/g;
  const missingVariables: string[] = [];
  let match;

  while ((match = regexVariable.exec(text)) !== null) {
    let variable = match[1];
    if (variable.includes('_.')) {
      variable = variable.split('_.')[1];
    }
    // Check if the variable is not present in the context
    if (_get(templatingContext, variable) === undefined) {
      missingVariables.push(variable);
    }
  }
  return missingVariables;
}

export interface HelperContext {
  context: {
    value: string | number;

  };
  meta: { requestId?: string; workspaceId?: string };
  renderPurpose?: 'send' | 'render' | 'no-render' | 'script';
  util: {
    render: (str: string) => string | Promise<string | null>;
    models: {
      request: {
        getById: (id: string) => Promise<Request | null>;
        getAncestors: (request: Request) => Promise<(Request | RequestGroup | Workspace)[]>;
      };
      workspace: { getById: (id: string) => Promise<Workspace | null> };
      oAuth2Token: { getByRequestId: (id: string) => Promise<any> };
      cookieJar: { getOrCreateForWorkspace: (workspace: Workspace) => Promise<any> };
      response: {
        getLatestForRequestId: typeof getLatestForRequest;
        getBodyBuffer: typeof getBodyBuffer;
      };
    };
  };
}

export function decodeEncoding<T>(value: T) {
  if (typeof value !== 'string') {
    return value;
  }

  const results = value.match(/^b64::(.+)::46b$/);

  if (results) {
    return Buffer.from(results[1], 'base64').toString('utf8');
  }

  return value;
}
