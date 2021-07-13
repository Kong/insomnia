import { showModal } from '../../components/modals';
import AskModal from '../../components/modals/ask-modal';
import { WorkspaceScope, WorkspaceScopeKeys } from '../../../models/workspace';
import { showSelectModal } from '../../components/modals/select-modal';
import { BASE_SPACE_ID, Space } from '../../../models/space';
import { getAppName } from '../../../common/constants';

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

export type SetSpaceIdPrompt = () => Promise<string | null>;
export function askToImportIntoSpace({ spaces, activeSpace }: { spaces: Space[]; activeSpace?: Space; }): SetSpaceIdPrompt {
  return function() {
    return new Promise(resolve => {
      // If no spaces exist, return null (indicating no parent/space)
      if (spaces.length === 0) {
        return resolve(null);
      }

      const options = [{ name: getAppName(), value: BASE_SPACE_ID }, ...spaces.map(space => ({ name: space.name, value: space._id }))];

      const defaultValue = activeSpace?._id || options[0].value;

      showSelectModal({
        title: 'Import',
        message: 'Select a space to import into',
        options,
        value: defaultValue,
        noEscape: true,
        onDone: selectedSpaceId => {
          resolve(selectedSpaceId === BASE_SPACE_ID ? null : selectedSpaceId);
        },
      });
    });
  };
}
