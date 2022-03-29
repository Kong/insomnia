import { strings } from '../../../common/strings';
import { Project } from '../../../models/project';
import { Workspace, WorkspaceScope, WorkspaceScopeKeys } from '../../../models/workspace';
import { showModal } from '../../components/modals';
import { AskModal } from '../../components/modals/ask-modal';
import { showSelectModal } from '../../components/modals/select-modal';

export enum ForceToWorkspace {
  new = 'new',
  current = 'current',
  existing = 'existing'
}

export type SelectExistingWorkspacePrompt = Promise<string | null>;
export function askToSelectExistingWorkspace(workspaces: Workspace[]): SelectExistingWorkspacePrompt {
  return new Promise(resolve => {
    const options = workspaces.map(workspace => ({ name: workspace.name, value: workspace._id }));

    showSelectModal({
      title: 'Import',
      message: `Select a ${strings.workspace.singular.toLowerCase()} to import into`,
      options,
      value: options[0]?.value,
      noEscape: true,
      onDone: workspaceId => {
        resolve(workspaceId);
      },
    });
  });
}

async function askToImportIntoNewWorkspace(): Promise<boolean> {
  return new Promise(resolve => {
    showModal(AskModal, {
      title: 'Import',
      message: `Do you want to import into an existing ${strings.workspace.singular.toLowerCase()} or a new one?`,
      yesText: 'Existing',
      noText: 'New',
      onDone: (yes: boolean) => {
        resolve(yes);
      },
    });
  });
}

// Returning null instead of a string will create a new workspace
export type ImportToWorkspacePrompt = () => null | string | Promise<null | string>;
export function askToImportIntoWorkspace({ workspaceId, forceToWorkspace, activeProjectWorkspaces }: { workspaceId?: string; forceToWorkspace?: ForceToWorkspace; activeProjectWorkspaces: Workspace[] }): ImportToWorkspacePrompt {
  return function() {
    switch (forceToWorkspace) {
      case ForceToWorkspace.new: {
        return null;
      }

      case ForceToWorkspace.current: {
        if (!workspaceId) {
          return null;
        }

        return workspaceId;
      }

      case ForceToWorkspace.existing: {
        // Return null if there are no available workspaces to chose from.
        if (activeProjectWorkspaces.length === 0) {
          return null;
        }

        return new Promise(async resolve => {
          const yes = await askToImportIntoNewWorkspace();
          if (yes) {
            const workspaceId = await askToSelectExistingWorkspace(activeProjectWorkspaces);
            resolve(workspaceId);
          } else {
            resolve(null);
          }
        });
      }

      default: {
        if (!workspaceId) {
          return null;
        }

        return new Promise(resolve => {
          showModal(AskModal, {
            title: 'Import',
            message: 'Do you want to import into the current workspace or a new one?',
            yesText: 'Current',
            noText: 'New Workspace',
            onDone: (yes: boolean) => {
              resolve(yes ? workspaceId : null);
            },
          });
        });
      }
    }
  };
}

export type SetWorkspaceScopePrompt = (name?: string) => WorkspaceScope | Promise<WorkspaceScope>;
export function askToSetWorkspaceScope(scope?: WorkspaceScope): SetWorkspaceScopePrompt {
  return name => {
    switch (scope) {
      case WorkspaceScopeKeys.collection:
      case WorkspaceScopeKeys.design:
        return scope;

      default:
        return new Promise(resolve => {
          const message = name
            ? `How would you like to import "${name}"?`
            : 'Do you want to import as a Request Collection or a Design Document?';

          showModal(AskModal, {
            title: 'Import As',
            message,
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

export type SetProjectIdPrompt = () => Promise<string>;
export function askToImportIntoProject({ projects, activeProject }: { projects: Project[]; activeProject: Project }): SetProjectIdPrompt {
  return function() {
    return new Promise(resolve => {
      // If only one project exists, return that
      if (projects.length === 1) {
        return resolve(projects[0]._id);
      }

      const options = projects.map(project => ({ name: project.name, value: project._id }));
      const defaultValue = activeProject._id;

      showSelectModal({
        title: 'Import',
        message: `Select a ${strings.project.singular.toLowerCase()} to import into`,
        options,
        value: defaultValue,
        noEscape: true,
        onDone: selectedProjectId => {
          // @ts-expect-error onDone can send null as an argument; why/how?
          resolve(selectedProjectId);
        },
      });
    });
  };
}
