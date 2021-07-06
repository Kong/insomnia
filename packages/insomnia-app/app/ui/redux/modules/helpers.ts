import { showModal } from '../../components/modals';
import AskModal from '../../components/modals/ask-modal';
import { WorkspaceScope, WorkspaceScopeKeys } from '../../../models/workspace';

export enum ForceToWorkspace {
  new = 'new',
  current = 'current'
}

export type ImportToWorkspacePrompt = () => null | string | Promise<null | string>;
export function askToImportIntoWorkspace({ workspaceId, forceToWorkspace }: { workspaceId?: string; forceToWorkspace?: ForceToWorkspace; }): ImportToWorkspacePrompt {
  return function() {
    if (!workspaceId) {
      return null;
    }

    switch (forceToWorkspace) {
      case ForceToWorkspace.new:
        return null;

      case ForceToWorkspace.current:
        return workspaceId;

      default:
        return new Promise(resolve => {
          showModal(AskModal, {
            title: 'Import',
            message: 'Do you want to import into the current workspace or a new one?',
            yesText: 'Current',
            noText: 'New Workspace',
            onDone: yes => {
              resolve(yes ? workspaceId : null);
            },
          });
        });
    }
  };
}

export type SetWorkspaceScopePrompt = (name: string) => WorkspaceScope | Promise<WorkspaceScope>;
export function askToSetWorkspaceScope(scope?: WorkspaceScope): SetWorkspaceScopePrompt {
  return function(name: string) {
    switch (scope) {
      case WorkspaceScopeKeys.collection:
      case WorkspaceScopeKeys.design:
        return scope;

      default:
        return new Promise(resolve => {
          showModal(AskModal, {
            title: 'Import As',
            message: `How would you like to import "${name}"?`,
            noText: 'Request Collection',
            yesText: 'Design Document',
            onDone: yes => {
              resolve(yes ? WorkspaceScopeKeys.design : WorkspaceScopeKeys.collection);
            },
          });
        });
    }
  };
}
