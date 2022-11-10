import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  GlobalActivity,
} from '../../../../common/constants';
import {
  LOCALSTORAGE_PREFIX,
  SET_ACTIVE_ACTIVITY,
  SET_ACTIVE_PROJECT,
  SET_ACTIVE_WORKSPACE,
  setActiveActivity,
  setActiveProject,
  setActiveWorkspace,
} from '../global';

jest.mock('../../../../common/analytics');

describe('global', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    jest.resetAllMocks();
    global.localStorage.clear();
  });

  describe('setActiveActivity', () => {
    it.each([
      ACTIVITY_SPEC,
      ACTIVITY_DEBUG,
      ACTIVITY_UNIT_TEST,
      ACTIVITY_HOME,
    ])('should update local storage and track event: %s', (activity: GlobalActivity) => {
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity,
      };
      expect(setActiveActivity(activity)).toStrictEqual(expectedEvent);
      expect(global.localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activity`)).toBe(
        JSON.stringify(activity),
      );
    });
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
