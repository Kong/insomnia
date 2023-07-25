import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import {
  LOCALSTORAGE_PREFIX,
  SET_ACTIVE_PROJECT,
  SET_ACTIVE_WORKSPACE,
  setActiveProject,
  setActiveWorkspace,
} from '../global';

jest.mock('../../../../ui/analytics');

describe('global', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    jest.resetAllMocks();
    global.localStorage.clear();
  });

  describe('setActiveProject', () => {
    it('should update local storage', () => {
      const projectId = 'id';
      const expectedEvent = {
        type: SET_ACTIVE_PROJECT,
        projectId,
      };
      expect(setActiveProject(projectId)).toStrictEqual(expectedEvent);
      expect(global.localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activeProjectId`)).toBe(
        JSON.stringify(projectId),
      );
    });
  });

  describe('setActiveWorkspace', () => {
    it('should update local storage', () => {
      const workspaceId = 'id';
      const expectedEvent = {
        type: SET_ACTIVE_WORKSPACE,
        workspaceId,
      };
      expect(setActiveWorkspace(workspaceId)).toStrictEqual(expectedEvent);
      expect(global.localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activeWorkspaceId`)).toBe(
        JSON.stringify(workspaceId),
      );
    });
  });
});
