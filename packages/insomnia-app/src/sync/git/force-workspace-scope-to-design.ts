import { BaseModel } from '../../models';
import { isWorkspace, WorkspaceScopeKeys } from '../../models/workspace';

/**
 * When a workspace comes from a git repository, the scope should always be a design document.
 * Sometimes, a repository that was created from an older version of Insomnia Designer might have scope = null, which automatically migrates to a collection which disables all git functionality.
 * So, if we are coming from git then always force the scope to design.
 */
export const forceWorkspaceScopeToDesign = (doc: BaseModel) => {
  if (isWorkspace(doc)) {
    doc.scope = WorkspaceScopeKeys.design;
  }
};
