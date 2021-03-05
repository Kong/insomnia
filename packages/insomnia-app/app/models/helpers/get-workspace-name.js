// @flow

import type { ApiSpec } from '../api-spec';
import type { Workspace } from '../workspace';
import { isDesigner } from './is-model';

export default function getWorkspaceName(w: Workspace, s: ApiSpec): string {
  return isDesigner(w) ? s.fileName : w.name;
}
