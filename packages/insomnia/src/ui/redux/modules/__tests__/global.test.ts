import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  GlobalActivity,
  SORT_MODIFIED_DESC,
} from '../../../../common/constants';
import * as models from '../../../../models';
import { DEFAULT_PROJECT_ID } from '../../../../models/project';
import {
  initActiveActivity,
  initActiveProject,
  initActiveWorkspace,
  initDashboardSortOrder,
  LOCALSTORAGE_PREFIX,
  SET_ACTIVE_ACTIVITY,
  SET_ACTIVE_PROJECT,
  SET_ACTIVE_WORKSPACE,
  SET_DASHBOARD_SORT_ORDER,
  setActiveActivity,
  setActiveProject,
  setActiveWorkspace,
} from '../global';

jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createSettings = (hasPromptedAnalytics: boolean) => {
  const settings = models.settings.init();
  settings.hasPromptedAnalytics = hasPromptedAnalytics;
  return settings;
};

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

  describe('initActiveWorkspace', () => {
    it('should initialize from local storage', () => {
      const workspaceId = 'id';
      global.localStorage.setItem(
        `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`,
        JSON.stringify(workspaceId),
      );
      const expectedEvent = {
        type: SET_ACTIVE_WORKSPACE,
        workspaceId,
      };
      expect(initActiveWorkspace()).toStrictEqual(expectedEvent);
    });
  });

  describe('initActiveProject', () => {
    it('should initialize from local storage', () => {
      const projectId = 'id';
      global.localStorage.setItem(
        `${LOCALSTORAGE_PREFIX}::activeProjectId`,
        JSON.stringify(projectId),
      );
      const expectedEvent = {
        type: SET_ACTIVE_PROJECT,
        projectId,
      };
      expect(initActiveProject()).toStrictEqual(expectedEvent);
    });

    it('should default to default project if not exist', () => {
      const expectedEvent = {
        type: SET_ACTIVE_PROJECT,
        projectId: DEFAULT_PROJECT_ID,
      };
      expect(initActiveProject()).toStrictEqual(expectedEvent);
    });
  });

  describe('initDashboardSortOrder', () => {
    it('should initialize from local storage', () => {
      const sortOrder = SORT_MODIFIED_DESC;

      global.localStorage.setItem(
        `${LOCALSTORAGE_PREFIX}::dashboard-sort-order`,
        JSON.stringify(sortOrder),
      );

      const expectedEvent = {
        'payload': {
          sortOrder,
        },
        'type': SET_DASHBOARD_SORT_ORDER,
      };

      expect(initDashboardSortOrder()).toStrictEqual(expectedEvent);
    });

    it('should default to modified-desc if not exist', async () => {
      const expectedEvent = {
        'payload': {
          sortOrder: SORT_MODIFIED_DESC,
        },
        'type': SET_DASHBOARD_SORT_ORDER,
      };

      expect(initDashboardSortOrder()).toStrictEqual(expectedEvent);
    });
  });

  describe('initActiveActivity', () => {
    it.each([
      ACTIVITY_SPEC,
      ACTIVITY_DEBUG,
      ACTIVITY_UNIT_TEST,
      ACTIVITY_HOME,
    ])('should initialize %s from local storage', async activity => {
      const settings = createSettings(true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity,
      };
      store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it.each([
      'something',
      null,
      undefined,
    ])('should go to home if initialized with an unsupported value: %s', async activity => {
      const settings = createSettings(true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_HOME,
      };
      store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to home if local storage key not found', async () => {
      const settings = createSettings(true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_HOME,
      };
      store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

  });
});
