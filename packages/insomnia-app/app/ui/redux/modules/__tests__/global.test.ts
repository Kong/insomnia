import fs from 'fs';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { trackEvent } from '../../../../common/analytics';
import {
  ACTIVITY_ANALYTICS,
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  DEPRECATED_ACTIVITY_INSOMNIA,
  GlobalActivity,
  SORT_MODIFIED_DESC,
} from '../../../../common/constants';
import { database } from '../../../../common/database';
import { getDesignerDataDir } from '../../../../common/electron-helpers';
import * as models from '../../../../models';
import { DEFAULT_PROJECT_ID } from '../../../../models/project';
import {
  goToNextActivity,
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

const createSettings = (
  hasPromptedMigration: boolean,
  hasPromptedOnboarding: boolean,
  hasPromptedAnalytics: boolean,
) => {
  const settings = models.settings.init();
  settings.hasPromptedOnboarding = hasPromptedOnboarding;
  settings.hasPromptedToMigrateFromDesigner = hasPromptedMigration;
  settings.hasPromptedAnalytics = hasPromptedAnalytics;
  return settings;
};

describe('global', () => {
  let fsExistsSyncSpy;
  beforeEach(async () => {
    await globalBeforeEach();
    jest.resetAllMocks();
    global.localStorage.clear();
    fsExistsSyncSpy = jest.spyOn(fs, 'existsSync');
  });

  describe('setActiveActivity', () => {
    it.each([
      ACTIVITY_SPEC,
      ACTIVITY_DEBUG,
      ACTIVITY_UNIT_TEST,
      ACTIVITY_HOME,
      ACTIVITY_ONBOARDING,
      ACTIVITY_MIGRATION,
    ])('should update local storage and track event: %s', (activity: GlobalActivity) => {
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity,
      };
      expect(setActiveActivity(activity)).toStrictEqual(expectedEvent);
      expect(trackEvent).toHaveBeenCalledWith('Activity', 'Change', activity);
      expect(global.localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activity`)).toBe(
        JSON.stringify(activity),
      );
    });

    it('should update flag for onboarding prompted', async done => {
      await models.settings.patch({
        hasPromptedToMigrateFromDesigner: false,
        hasPromptedOnboarding: false,
      });

      async function onDatabaseChange() {
        const settings = await models.settings.getOrCreate();
        expect(settings.hasPromptedToMigrateFromDesigner).toBe(false);
        expect(settings.hasPromptedOnboarding).toBe(true);

        database.offChange(onDatabaseChange);
        done();
      }

      database.onChange(onDatabaseChange);

      setActiveActivity(ACTIVITY_ONBOARDING);
    });

    it('should update flag for migration prompted', async done => {
      await models.settings.patch({
        hasPromptedToMigrateFromDesigner: false,
        hasPromptedOnboarding: false,
      });

      async function onDatabaseChange() {
        const settings = await models.settings.getOrCreate();
        expect(settings.hasPromptedToMigrateFromDesigner).toBe(true);
        expect(settings.hasPromptedOnboarding).toBe(false);
        database.offChange(onDatabaseChange);
        done();
      }

      database.onChange(onDatabaseChange);

      setActiveActivity(ACTIVITY_MIGRATION);
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

  describe('goToNextActivity', () => {
    it('should go from onboarding to home', async () => {
      const settings = createSettings(false, false, true);
      const activeActivity = ACTIVITY_ONBOARDING;
      const store = mockStore({
        global: {
          activeActivity,
        },
        entities: {
          settings: [settings],
        },
      });
      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_HOME,
        },
      ]);
    });

    it('should go from migration to onboarding', async () => {
      const settings = createSettings(false, false, true);
      const activeActivity = ACTIVITY_MIGRATION;
      const store = mockStore({
        global: {
          activeActivity,
        },
        entities: {
          settings: [settings],
        },
      });
      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_ONBOARDING,
        },
      ]);
    });

    it('should go from migration to analytics', async () => {
      const settings = createSettings(false, true, false);
      const activeActivity = ACTIVITY_MIGRATION;
      const store = mockStore({
        global: {
          activeActivity,
        },
        entities: {
          settings: [settings],
        },
      });
      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_ANALYTICS,
        },
      ]);
    });

    it('should go from migration to home', async () => {
      const settings = createSettings(true, true, true);
      const activeActivity = ACTIVITY_MIGRATION;
      const store = mockStore({
        global: {
          activeActivity,
        },
        entities: {
          settings: [settings],
        },
      });
      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_HOME,
        },
      ]);
    });

    it.each([ACTIVITY_SPEC, ACTIVITY_DEBUG, ACTIVITY_UNIT_TEST, ACTIVITY_HOME])(
      'should not change activity from: %s',
      async (activeActivity: GlobalActivity) => {
        const settings = createSettings(false, true, true);
        const store = mockStore({
          global: {
            activeActivity,
          },
          entities: {
            settings: [settings],
          },
        });
        await store.dispatch(goToNextActivity());
        expect(store.getActions()).toEqual([]);
      },
    );
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
      ACTIVITY_ONBOARDING,
      ACTIVITY_ANALYTICS,
    ])('should initialize %s from local storage', async activity => {
      const settings = createSettings(true, true, true);
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
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should initialize from local storage and migrate deprecated activity', async () => {
      const settings = createSettings(true, true, true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = DEPRECATED_ACTIVITY_INSOMNIA;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_DEBUG,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to onboarding if initialized at migration', async () => {
      const settings = createSettings(true, false, true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = ACTIVITY_MIGRATION;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_ONBOARDING,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it.each(
      'something',
      null,
      undefined,
    )('should go to home if initialized with an unsupported value: %s', async activity => {
      const settings = createSettings(true, true, true);
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
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to home if local storage key not found', async () => {
      const settings = createSettings(true, true, true);
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
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to home if initialized at migration and onboarding seen', async () => {
      const settings = createSettings(true, true, true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = ACTIVITY_MIGRATION;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_HOME,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should prompt to migrate', async () => {
      const settings = createSettings(false, true, true);
      fsExistsSyncSpy.mockReturnValue(true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_MIGRATION,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
      expect(fsExistsSyncSpy).toHaveBeenCalledWith(getDesignerDataDir());
    });

    it('should not prompt to migrate if default directory not found', async () => {
      const settings = createSettings(false, true, true);
      fsExistsSyncSpy.mockReturnValue(false);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
      expect(fsExistsSyncSpy).toHaveBeenCalledWith(getDesignerDataDir());
    });

    it('should prompt to onboard', async () => {
      const settings = createSettings(true, false, true);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_ONBOARDING,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should prompt to change analytics settings', async () => {
      const settings = createSettings(true, true, false);
      const store = mockStore({
        global: {},
        entities: {
          settings: [settings],
        },
      });
      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = {
        type: SET_ACTIVE_ACTIVITY,
        activity: ACTIVITY_ANALYTICS,
      };
      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });
  });
});
