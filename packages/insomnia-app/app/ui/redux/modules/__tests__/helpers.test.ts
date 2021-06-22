import { askToImportIntoWorkspace, ForceToWorkspaceKeys } from '../helpers';
import * as modals from '../../../components/modals';

describe('askToImportIntoWorkspace', () => {
  it('should return null if no active workspace', () => {
    const func = askToImportIntoWorkspace({ workspaceId: undefined, forceToWorkspace: ForceToWorkspaceKeys.new });
    expect(func()).toBeNull();
  });

  it('should return null if forcing to a new workspace', () => {
    const func = askToImportIntoWorkspace({ workspaceId: 'id', forceToWorkspace: ForceToWorkspaceKeys.new });
    expect(func()).toBeNull();
  });

  it('should return id if forcing to a current workspace', () => {
    const currentWorkspaceId = 'currentId';
    const func = askToImportIntoWorkspace({ workspaceId: currentWorkspaceId, forceToWorkspace: ForceToWorkspaceKeys.current });
    expect(func()).toBe(currentWorkspaceId);
  });

  it('should prompt the user if not forcing', () => {
    (modals as any).showModal = jest.fn();
    const currentWorkspaceId = 'current';
    const func = askToImportIntoWorkspace({ workspaceId: currentWorkspaceId });
    func();
    expect(modals.showModal).toHaveBeenCalledTimes(1);
  });
});
