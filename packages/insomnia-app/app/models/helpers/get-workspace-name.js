// @flow

import type { ApiSpec } from '../api-spec';
import type { Workspace } from '../workspace';
import { isDocument } from './is-model';

export default function getWorkspaceName(w: Workspace, s: ApiSpec): string {
  return isDocument(w) ? s.fileName : w.name;
}
