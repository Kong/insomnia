import type { ApiSpec } from '../api-spec';
import { isDesign, Workspace } from '../workspace';

export default function getWorkspaceName(w: Workspace, s: ApiSpec) {
  return isDesign(w) ? s.fileName : w.name;
}
