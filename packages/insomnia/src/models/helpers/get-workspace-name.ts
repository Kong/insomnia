import type { ApiSpec } from '../api-spec';
import { isDesign, Workspace } from '../workspace';

export default function getWorkspaceName(w: Workspace, s: ApiSpec | null) {
  return isDesign(w) ? (s?.fileName || 'my-spec.yaml') : w.name;
}
