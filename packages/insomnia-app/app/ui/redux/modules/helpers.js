// @flow
import { showModal } from '../../components/modals';
import AskModal from '../../components/modals/ask-modal';
import { WorkspaceScopeKeys } from '../../../models/workspace';

export const ForceToWorkspaceKeys = {
  new: 'new',
  current: 'current',
};

export type ForceToWorkspace = $Keys<typeof ForceToWorkspaceKeys>;

export function askToImportIntoWorkspace(workspaceId: string, forceToWorkspace?: ForceToWorkspace) {
  return function() {
    switch (forceToWorkspace) {
      case ForceToWorkspaceKeys.new:
        return null;
      case ForceToWorkspaceKeys.current:
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

export function askToSetWorkspaceScope(scope?: WorkspaceScope) {
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
