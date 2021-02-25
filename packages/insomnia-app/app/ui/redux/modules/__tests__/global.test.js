// @flow
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import type { GlobalActivity } from '../../../../common/constants';
import { trackEvent } from '../../../../common/analytics';
import {
  goToNextActivity,
  initActiveActivity,
  initActiveWorkspace,
  LOCALSTORAGE_PREFIX,
  SET_ACTIVE_ACTIVITY,
  SET_ACTIVE_WORKSPACE,
  setActiveActivity,
  setActiveWorkspace,
} from '../global';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  DEPRECATED_ACTIVITY_INSOMNIA,
} from '../../../../common/constants';
import * as models from '../../../../models';
import fs from 'fs';
import { getDesignerDataDir } from '../../../../common/misc';

jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createSettings = (hasPromptedMigration: boolean, hasPromptedOnboarding: boolean) => {
  const settings = models.settings.init();
  settings.hasPromptedOnboarding = hasPromptedOnboarding;
  settings.hasPromptedToMigrateFromDesigner = hasPromptedMigration;
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
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity };

      expect(setActiveActivity(activity)).toStrictEqual(expectedEvent);
      expect(trackEvent).toHaveBeenCalledWith('Activity', 'Change', activity);
      expect(global.localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activity`)).toBe(
        JSON.stringify(activity),
      );
    });

    it('should update flag for onboarding prompted', async () => {
      await models.settings.patch({
        hasPromptedToMigrateFromDesigner: false,
        hasPromptedOnboarding: false,
      });

      setActiveActivity(ACTIVITY_ONBOARDING);

      // We don't await the settings update in the action creator
      // so wait for it to update before checking
      await new Promise(resolve => setTimeout(resolve, 10));
      const settings = await models.settings.getOrCreate();
      expect(settings.hasPromptedToMigrateFromDesigner).toBe(false);
      expect(settings.hasPromptedOnboarding).toBe(true);
    });

    it('should update flag for migration prompted', async () => {
      await models.settings.patch({
        hasPromptedToMigrateFromDesigner: false,
        hasPromptedOnboarding: false,
      });

      setActiveActivity(ACTIVITY_MIGRATION);

      // We don't await the settings update in the action creator
      // so wait for it to update before checking
      await new Promise(resolve => setTimeout(resolve, 10));
      const settings = await models.settings.getOrCreate();
      expect(settings.hasPromptedToMigrateFromDesigner).toBe(true);
      expect(settings.hasPromptedOnboarding).toBe(false);
    });
  });

  describe('setActiveWorkspace', () => {
    it('should update local storage', () => {
      const workspaceId = 'id';
      const expectedEvent = { type: SET_ACTIVE_WORKSPACE, workspaceId };

      expect(setActiveWorkspace(workspaceId)).toStrictEqual(expectedEvent);
      expect(global.localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activeWorkspaceId`)).toBe(
        JSON.stringify(workspaceId),
      );
    });
  });

  describe('goToNextActivity', () => {
    it('should go from onboarding to home', async () => {
      const settings = createSettings(false, false);

      const activeActivity = ACTIVITY_ONBOARDING;
      const store = mockStore({ global: { activeActivity }, entities: { settings: [settings] } });

      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([{ type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_HOME }]);
    });

    it('should go from migration to onboarding', async () => {
      const settings = createSettings(false, false);

      const activeActivity = ACTIVITY_MIGRATION;
      const store = mockStore({ global: { activeActivity }, entities: { settings: [settings] } });

      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([
        { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_ONBOARDING },
      ]);
    });

    it('should go from migration to home', async () => {
      const settings = createSettings(true, true);

      const activeActivity = ACTIVITY_MIGRATION;
      const store = mockStore({ global: { activeActivity }, entities: { settings: [settings] } });

      await store.dispatch(goToNextActivity());
      expect(store.getActions()).toEqual([{ type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_HOME }]);
    });

    it.each([ACTIVITY_SPEC, ACTIVITY_DEBUG, ACTIVITY_UNIT_TEST, ACTIVITY_HOME])(
      'should not change activity from: %s',
      async (activeActivity: GlobalActivity) => {
        const settings = createSettings(false, true);

        const store = mockStore({ global: { activeActivity }, entities: { settings: [settings] } });

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
      const expectedEvent = { type: SET_ACTIVE_WORKSPACE, workspaceId };

      expect(initActiveWorkspace()).toStrictEqual(expectedEvent);
    });
  });

  describe('initActiveActivity', () => {
    it.each([
      ACTIVITY_SPEC,
      ACTIVITY_DEBUG,
      ACTIVITY_UNIT_TEST,
      ACTIVITY_HOME,
      ACTIVITY_ONBOARDING,
    ])('should initialize %s from local storage', async activity => {
      const settings = createSettings(true, true);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should initialize from local storage and migrate deprecated activity', async () => {
      const settings = createSettings(true, true);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const activity = DEPRECATED_ACTIVITY_INSOMNIA;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_DEBUG };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to onboarding if initialized at migration', async () => {
      const settings = createSettings(true, false);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const activity = ACTIVITY_MIGRATION;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_ONBOARDING };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it.each(
      'something',
      null,
      undefined,
    )('should go to home if initialized with an unsupported value: %s', async activity => {
      const settings = createSettings(true, true);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_HOME };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to home if local storage key not found', async () => {
      const settings = createSettings(true, true);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_HOME };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should go to home if initialized at migration and onboarding seen', async () => {
      const settings = createSettings(true, true);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const activity = ACTIVITY_MIGRATION;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_HOME };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });

    it('should prompt to migrate', async () => {
      const settings = createSettings(false, true);
      fsExistsSyncSpy.mockReturnValue(true);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_MIGRATION };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
      expect(fsExistsSyncSpy).toHaveBeenCalledWith(getDesignerDataDir());
    });

    it('should not prompt to migrate if default directory not found', async () => {
      const settings = createSettings(false, true);
      fsExistsSyncSpy.mockReturnValue(false);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
      expect(fsExistsSyncSpy).toHaveBeenCalledWith(getDesignerDataDir());
    });

    it('should prompt to onboard', async () => {
      const settings = createSettings(true, false);

      const store = mockStore({ global: {}, entities: { settings: [settings] } });

      const activity = ACTIVITY_HOME;
      global.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
      const expectedEvent = { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_ONBOARDING };

      await store.dispatch(initActiveActivity());
      expect(store.getActions()).toEqual([expectedEvent]);
    });
  });
});
