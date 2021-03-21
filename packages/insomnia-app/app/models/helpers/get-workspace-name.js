// @flow

import type { ApiSpec } from '../api-spec';
import type { Workspace } from '../workspace';
import { isDesign } from './is-model';

export default function getWorkspaceName(w: Workspace, s: ApiSpec): string {
  return isDesign(w) ? s.fileName : w.name;
}
