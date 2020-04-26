// @flow

import { askToImportIntoWorkspace, ForceToWorkspaceKeys } from '../helpers';
import * as modals from '../../../components/modals';

describe('askToImportIntoWorkspace', () => {
  it('should return null if forcing to a new workspace', () => {
    const func = askToImportIntoWorkspace('id', ForceToWorkspaceKeys.new);

    expect(func()).toBeNull();
  });

  it('should return id if forcing to a current workspace', () => {
    const currentWorkspaceId = 'currentId';
    const func = askToImportIntoWorkspace(currentWorkspaceId, ForceToWorkspaceKeys.current);

    expect(func()).toBe(currentWorkspaceId);
  });

  it('should prompt the user if not forcing', () => {
    modals.showModal = jest.fn();

    const currentWorkspaceId = 'current';
    const func = askToImportIntoWorkspace(currentWorkspaceId);

    func();
    expect(modals.showModal).toHaveBeenCalledTimes(1);
  });
});
