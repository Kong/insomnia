import electron from 'electron';
import fs, { NoParamCallback } from 'fs';
import moment from 'moment';
import path from 'path';
import React, { Fragment } from 'react';
import { combineReducers, Dispatch } from 'redux';
import { unreachableCase } from 'ts-assert-unreachable';

import { trackEvent } from '../../../common/analytics';
import type { DashboardSortOrder, GlobalActivity } from '../../../common/constants';
import {
  ACTIVITY_ANALYTICS,
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  DEPRECATED_ACTIVITY_INSOMNIA,
  isValidActivity,
} from '../../../common/constants';
import { database } from '../../../common/database';
import { getDesignerDataDir } from '../../../common/electron-helpers';
import {
  exportRequestsData,
  exportRequestsHAR,
  exportWorkspacesData,
  exportWorkspacesHAR,
} from '../../../common/export';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { Environment, isEnvironment } from '../../../models/environment';
import { GrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { DEFAULT_PROJECT_ID } from '../../../models/project';
import { Request } from '../../../models/request';
import { Settings } from '../../../models/settings';
import { isWorkspace } from '../../../models/workspace';
import { reloadPlugins } from '../../../plugins';
import { createPlugin } from '../../../plugins/create';
import install from '../../../plugins/install';
import { setTheme } from '../../../plugins/misc';
import { AskModal } from '../../../ui/components/modals/ask-modal';
import { AlertModal } from '../../components/modals/alert-modal';
import { showAlert, showError, showModal } from '../../components/modals/index';
import { LoginModal } from '../../components/modals/login-modal';
import { PaymentNotificationModal } from '../../components/modals/payment-notification-modal';
import { SelectModal } from '../../components/modals/select-modal';
import {
  SettingsModal,
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../../components/modals/settings-modal';
import { selectActiveProjectName, selectSettings, selectWorkspacesForActiveProject } from '../selectors';
import { importUri } from './import';

export const LOCALSTORAGE_PREFIX = 'insomnia::meta';
const LOGIN_STATE_CHANGE = 'global/login-state-change';
export const LOAD_START = 'global/load-start';
export const LOAD_STOP = 'global/load-stop';
const LOAD_REQUEST_START = 'global/load-request-start';
const LOAD_REQUEST_STOP = 'global/load-request-stop';
export const SET_ACTIVE_PROJECT = 'global/activate-project';
export const SET_DASHBOARD_SORT_ORDER = 'global/dashboard-sort-order';
export const SET_ACTIVE_WORKSPACE = 'global/activate-workspace';
export const SET_ACTIVE_ACTIVITY = 'global/activate-activity';
const COMMAND_ALERT = 'app/alert';
const COMMAND_LOGIN = 'app/auth/login';
const COMMAND_TRIAL_END = 'app/billing/trial-end';
const COMMAND_IMPORT_URI = 'app/import';
const COMMAND_PLUGIN_INSTALL = 'plugins/install';
const COMMAND_PLUGIN_THEME = 'plugins/theme';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //
function activeActivityReducer(state: string | null = null, action) {
  switch (action.type) {
    case SET_ACTIVE_ACTIVITY:
      return action.activity;

    default:
      return state;
  }
}

function activeProjectReducer(state: string = DEFAULT_PROJECT_ID, action) {
  switch (action.type) {
    case SET_ACTIVE_PROJECT:
      return action.projectId;

    default:
      return state;
  }
}

function dashboardSortOrderReducer(state: DashboardSortOrder = 'modified-desc', action) {
  switch (action.type) {
    case SET_DASHBOARD_SORT_ORDER:
      return action.payload.sortOrder;

    default:
      return state;
  }
}

function activeWorkspaceReducer(state: string | null = null, action) {
  switch (action.type) {
    case SET_ACTIVE_WORKSPACE:
      return action.workspaceId;

    default:
      return state;
  }
}

function loadingReducer(state = false, action) {
  switch (action.type) {
    case LOAD_START:
      return true;

    case LOAD_STOP:
      return false;

    default:
      return state;
  }
}

function loadingRequestsReducer(state: Record<string, number> = {}, action) {
  switch (action.type) {
    case LOAD_REQUEST_START:
      return Object.assign({}, state, {
        [action.requestId]: action.time,
      });

    case LOAD_REQUEST_STOP:
      return Object.assign({}, state, {
        [action.requestId]: -1,
      });

    default:
      return state;
  }
}

function loginStateChangeReducer(state = false, action) {
  switch (action.type) {
    case LOGIN_STATE_CHANGE:
      return action.loggedIn;

    default:
      return state;
  }
}

export interface GlobalState {
  isLoading: boolean;
  activeProjectId: string;
  dashboardSortOrder: DashboardSortOrder;
  activeWorkspaceId: string | null;
  activeActivity: GlobalActivity | null;
  isLoggedIn: boolean;
  loadingRequestIds: Record<string, number>;
}

export const reducer = combineReducers<GlobalState>({
  isLoading: loadingReducer,
  dashboardSortOrder: dashboardSortOrderReducer,
  loadingRequestIds: loadingRequestsReducer,
  activeProjectId: activeProjectReducer,
  activeWorkspaceId: activeWorkspaceReducer,
  activeActivity: activeActivityReducer,
  isLoggedIn: loginStateChangeReducer,
});

// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export const newCommand = (command: string, args: any) => async (dispatch: Dispatch<any>) => {
  switch (command) {
    case COMMAND_ALERT:
      showModal(AlertModal, {
        title: args.title,
        message: args.message,
      });
      break;

    case COMMAND_LOGIN:
      showModal(LoginModal, {
        title: args.title,
        message: args.message,
      });
      break;

    case COMMAND_TRIAL_END:
      showModal(PaymentNotificationModal);
      break;

    case COMMAND_IMPORT_URI:
      await showModal(AlertModal, {
        title: 'Confirm Data Import',
        message: (
          <span>
            Do you really want to import {args.name && (<><code>{args.name}</code> from</>)} <code>{args.uri}</code>?
          </span>
        ),
        addCancel: true,
      });
      dispatch(importUri(args.uri, { workspaceId: args.workspaceId, forceToProject: 'prompt' }));
      break;

    case COMMAND_PLUGIN_INSTALL:
      showModal(AskModal, {
        title: 'Plugin Install',
        message: (
          <Fragment>
            Do you want to install <code>{args.name}</code>?
          </Fragment>
        ),
        yesText: 'Install',
        noText: 'Cancel',
        onDone: async (isYes: boolean) => {
          if (!isYes) {
            return;
          }

          try {
            await install(args.name);
            showModal(SettingsModal, TAB_INDEX_PLUGINS);
          } catch (err) {
            showError({
              title: 'Plugin Install',
              message: 'Failed to install plugin',
              error: err.message,
            });
          }
        },
      });
      break;

    case COMMAND_PLUGIN_THEME:
      const parsedTheme = JSON.parse(decodeURIComponent(args.theme));
      showModal(AskModal, {
        title: 'Install Theme',
        message: (
          <Fragment>
            Do you want to install <code>{parsedTheme.displayName}</code>?
          </Fragment>
        ),
        yesText: 'Install',
        noText: 'Cancel',
        onDone: async (isYes: boolean) => {
          if (!isYes) {
            return;
          }

          const mainJsContent = `module.exports.themes = [${JSON.stringify(
            parsedTheme,
            null,
            2,
          )}];`;
          await createPlugin(`theme-${parsedTheme.name}`, '0.0.1', mainJsContent);
          const settings = await models.settings.getOrCreate();
          await models.settings.update(settings, {
            theme: parsedTheme.name,
          });
          await reloadPlugins();
          await setTheme(parsedTheme.name);
          showModal(SettingsModal, TAB_INDEX_THEMES);
        },
      });
      break;

    default: // Nothing
  }
};

export const loadStart = () => ({
  type: LOAD_START,
});

export const loadStop = () => ({
  type: LOAD_STOP,
});

export const loadRequestStart = (requestId: string) => ({
  type: LOAD_REQUEST_START,
  requestId,
  time: Date.now(),
});

export const loginStateChange = (loggedIn: boolean) => ({
  type: LOGIN_STATE_CHANGE,
  loggedIn,
});

export const loadRequestStop = (requestId: string) => ({
  type: LOAD_REQUEST_STOP,
  requestId,
});

function _getNextActivity(settings: Settings, currentActivity: GlobalActivity): GlobalActivity {
  switch (currentActivity) {
    case ACTIVITY_MIGRATION:
      // Has not seen the onboarding step? Go to onboarding
      if (!settings.hasPromptedOnboarding) {
        return ACTIVITY_ONBOARDING;
      }

      // Has not seen the analytics prompt? Go to it
      if (!settings.hasPromptedAnalytics) {
        return ACTIVITY_ANALYTICS;
      }

      // Otherwise, go to home
      return ACTIVITY_HOME;

    case ACTIVITY_ONBOARDING:
      // Always go to home after onboarding
      return ACTIVITY_HOME;

    default:
      return currentActivity;
  }
}

/*
  Go to the next activity in a sequential activity flow, depending on different conditions
 */
export const goToNextActivity = () => (dispatch, getState) => {
  const state = getState();
  const { activeActivity } = state.global;
  const settings = selectSettings(state);

  const nextActivity = _getNextActivity(settings, activeActivity);

  if (nextActivity !== activeActivity) {
    dispatch(setActiveActivity(nextActivity));
  }
};

/*
  Go to an explicit activity
 */
export const setActiveActivity = (activity: GlobalActivity) => {
  activity = _normalizeActivity(activity);

  // Don't need to await settings update
  switch (activity) {
    case ACTIVITY_MIGRATION:
      trackEvent('Data', 'Migration', 'Manual');
      models.settings.patch({
        hasPromptedToMigrateFromDesigner: true,
      });
      break;

    case ACTIVITY_ONBOARDING:
      models.settings.patch({
        hasPromptedOnboarding: true,
        // Don't show the analytics preferences prompt as it is part of the onboarding flow
        hasPromptedAnalytics: true,
      });
      break;

    case ACTIVITY_ANALYTICS:
      models.settings.patch({
        hasPromptedAnalytics: true,
      });
      break;

    default:
      break;
  }

  window.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
  trackEvent('Activity', 'Change', activity);
  return {
    type: SET_ACTIVE_ACTIVITY,
    activity,
  };
};

export const setActiveProject = (projectId: string) => {
  const key = `${LOCALSTORAGE_PREFIX}::activeProjectId`;
  window.localStorage.setItem(key, JSON.stringify(projectId));
  return {
    type: SET_ACTIVE_PROJECT,
    projectId,
  };
};

export const setDashboardSortOrder = (sortOrder: DashboardSortOrder) => {
  const key = `${LOCALSTORAGE_PREFIX}::dashboard-sort-order`;
  window.localStorage.setItem(key, JSON.stringify(sortOrder));
  return {
    type: SET_DASHBOARD_SORT_ORDER,
    payload: {
      sortOrder,
    },
  };
};

export const setActiveWorkspace = (workspaceId: string | null) => {
  const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
  window.localStorage.setItem(key, JSON.stringify(workspaceId));
  return {
    type: SET_ACTIVE_WORKSPACE,
    workspaceId,
  };
};

const VALUE_JSON = 'json';
const VALUE_YAML = 'yaml';
const VALUE_HAR = 'har';

export type SelectedFormat =
  | typeof VALUE_HAR
  | typeof VALUE_JSON
  | typeof VALUE_YAML
  ;

const showSelectExportTypeModal = ({ onCancel, onDone }: {
  onCancel: () => void;
  onDone: (selectedFormat: SelectedFormat) => Promise<void>;
}) => {
  const options = [
    {
      name: 'Insomnia v4 (JSON)',
      value: VALUE_JSON,
    },
    {
      name: 'Insomnia v4 (YAML)',
      value: VALUE_YAML,
    },
    {
      name: 'HAR – HTTP Archive Format',
      value: VALUE_HAR,
    },
  ];

  const lastFormat = window.localStorage.getItem('insomnia.lastExportFormat');
  const defaultValue = options.find(({ value }) => value === lastFormat) ? lastFormat : VALUE_JSON;

  showModal(SelectModal, {
    title: 'Select Export Type',
    value: defaultValue,
    options,
    message: 'Which format would you like to export as?',
    onCancel,
    onDone: async (selectedFormat: SelectedFormat) => {
      window.localStorage.setItem('insomnia.lastExportFormat', selectedFormat);
      await onDone(selectedFormat);
    },
  });
};

const showExportPrivateEnvironmentsModal = (privateEnvNames: string) => showModal(AskModal, {
  title: 'Export Private Environments?',
  message: `Do you want to include private environments (${privateEnvNames}) in your export?`,
});

const showSaveExportedFileDialog = async ({
  exportedFileNamePrefix,
  selectedFormat,
}: {
  exportedFileNamePrefix: string;
  selectedFormat: SelectedFormat;
}) => {
  const date = moment().format('YYYY-MM-DD');
  const name = exportedFileNamePrefix.replace(/ /g, '-');
  const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
  const dir = lastDir || electron.remote.app.getPath('desktop');
  const options = {
    title: 'Export Insomnia Data',
    buttonLabel: 'Export',
    defaultPath: `${path.join(dir, `${name}_${date}`)}.${selectedFormat}`,
  };
  const { filePath } = await electron.remote.dialog.showSaveDialog(options);
  return filePath || null;
};

const writeExportedFileToFileSystem = (filename: string, jsonData: string, onDone: NoParamCallback) => {
  // Remember last exported path
  window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));
  fs.writeFile(filename, jsonData, {}, onDone);
};

export const exportAllToFile = () => async (dispatch: Dispatch, getState) => {
  dispatch(loadStart());
  const state = getState();
  const activeProjectName = selectActiveProjectName(state);
  const workspaces = selectWorkspacesForActiveProject(state);

  if (!workspaces.length) {
    dispatch(loadStop());
    showAlert({
      title: 'Cannot export',
      message: <>There are no workspaces to export in the <strong>{activeProjectName}</strong> {strings.project.singular.toLowerCase()}.</>,
    });
    return;
  }

  showSelectExportTypeModal({
    onCancel: () => { dispatch(loadStop()); },
    onDone: async selectedFormat => {
      // Check if we want to export private environments.
      const environments = await models.environment.all();

      let exportPrivateEnvironments = false;
      const privateEnvironments = environments.filter(environment => environment.isPrivate);

      if (privateEnvironments.length) {
        const names = privateEnvironments.map(environment => environment.name).join(', ');
        exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
      }

      const fileName = await showSaveExportedFileDialog({
        exportedFileNamePrefix: 'Insomnia-All',
        selectedFormat,
      });

      if (!fileName) {
        // Cancelled.
        dispatch(loadStop());
        return;
      }

      let stringifiedExport;

      try {
        switch (selectedFormat) {
          case VALUE_HAR:
            stringifiedExport = await exportWorkspacesHAR(workspaces, exportPrivateEnvironments);
            break;

          case VALUE_YAML:
            stringifiedExport = await exportWorkspacesData(workspaces, exportPrivateEnvironments, 'yaml');
            break;

          case VALUE_JSON:
            stringifiedExport = await exportWorkspacesData(workspaces, exportPrivateEnvironments, 'json');
            break;

          default:
            unreachableCase(selectedFormat, `selected export format "${selectedFormat}" is invalid`);
        }
      } catch (err) {
        showError({
          title: 'Export Failed',
          error: err,
          message: 'Export failed due to an unexpected error',
        });
        dispatch(loadStop());
        return;
      }

      writeExportedFileToFileSystem(fileName, stringifiedExport, err => {
        if (err) {
          console.warn('Export failed', err);
        }

        dispatch(loadStop());
      });
    },
  });
};

export const exportRequestsToFile = (requestIds: string[]) => async (dispatch: Dispatch) => {
  dispatch(loadStart());
  showSelectExportTypeModal({
    onCancel: () => { dispatch(loadStop()); },
    onDone: async selectedFormat => {
      const requests: (GrpcRequest | Request)[] = [];
      const privateEnvironments: Environment[] = [];
      const workspaceLookup = {};

      for (const requestId of requestIds) {
        const request = await requestOperations.getById(requestId);

        if (request == null) {
          continue;
        }

        requests.push(request);
        const ancestors = await database.withAncestors(request, [
          models.workspace.type,
          models.requestGroup.type,
        ]);
        const workspace = ancestors.find(isWorkspace);

        if (workspace == null || workspaceLookup.hasOwnProperty(workspace._id)) {
          continue;
        }

        workspaceLookup[workspace._id] = true;
        const descendants = await database.withDescendants(workspace);
        const privateEnvs = descendants.filter(isEnvironment).filter(
          descendant => descendant.isPrivate,
        );
        privateEnvironments.push(...privateEnvs);
      }

      let exportPrivateEnvironments = false;

      if (privateEnvironments.length) {
        const names = privateEnvironments.map(e => e.name).join(', ');
        exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
      }

      const fileName = await showSaveExportedFileDialog({
        exportedFileNamePrefix: 'Insomnia',
        selectedFormat,
      });

      if (!fileName) {
        // Cancelled.
        dispatch(loadStop());
        return;
      }

      let stringifiedExport;

      try {
        switch (selectedFormat) {
          case VALUE_HAR:
            stringifiedExport = await exportRequestsHAR(requests, exportPrivateEnvironments);
            break;

          case VALUE_YAML:
            stringifiedExport = await exportRequestsData(requests, exportPrivateEnvironments, 'yaml');
            break;

          case VALUE_JSON:
            stringifiedExport = await exportRequestsData(requests, exportPrivateEnvironments, 'json');
            break;

          default:
            unreachableCase(selectedFormat, `selected export format "${selectedFormat}" is invalid`);
        }
      } catch (err) {
        showError({
          title: 'Export Failed',
          error: err,
          message: 'Export failed due to an unexpected error',
        });
        dispatch(loadStop());
        return;
      }

      writeExportedFileToFileSystem(fileName, stringifiedExport, err => {
        if (err) {
          console.warn('Export failed', err);
        }

        dispatch(loadStop());
      });
    },
  });
};

export function initActiveProject() {
  let projectId: string | null = null;

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activeProjectId`;
    const item = window.localStorage.getItem(key);
    // @ts-expect-error -- TSCONVERSION don't parse item if it's null
    projectId = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  return setActiveProject(projectId || DEFAULT_PROJECT_ID);
}

export function initDashboardSortOrder() {
  let dashboardSortOrder: DashboardSortOrder = 'modified-desc';

  try {
    const dashboardSortOrderKey = `${LOCALSTORAGE_PREFIX}::dashboard-sort-order`;
    const stringifiedDashboardSortOrder = window.localStorage.getItem(dashboardSortOrderKey);

    if (stringifiedDashboardSortOrder) {
      dashboardSortOrder = JSON.parse(stringifiedDashboardSortOrder);
    }
  } catch (e) {
    // Nothing here...
  }

  return setDashboardSortOrder(dashboardSortOrder);
}

export function initActiveWorkspace() {
  let workspaceId: string | null = null;

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
    const item = window.localStorage.getItem(key);
    // @ts-expect-error -- TSCONVERSION don't parse item if it's null
    workspaceId = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  return setActiveWorkspace(workspaceId);
}

function _migrateDeprecatedActivity(activity: GlobalActivity): GlobalActivity {
  // @ts-expect-error -- TSCONVERSION
  return activity === DEPRECATED_ACTIVITY_INSOMNIA ? ACTIVITY_DEBUG : activity;
}

function _normalizeActivity(activity: GlobalActivity): GlobalActivity {
  activity = _migrateDeprecatedActivity(activity);

  if (isValidActivity(activity)) {
    return activity;
  } else {
    const fallbackActivity = ACTIVITY_HOME;
    console.log(`[app] invalid activity "${activity}"; navigating to ${fallbackActivity}`);
    return fallbackActivity;
  }
}

/*
  Initialize with the cached active activity, and navigate to the next activity if necessary
  This will also decide whether to start with the migration or onboarding activities
 */
export const initActiveActivity = () => (dispatch, getState) => {
  const state = getState();
  const settings = selectSettings(state);
  // Default to home
  let activeActivity = ACTIVITY_HOME;

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activity`;
    const item = window.localStorage.getItem(key);
    // @ts-expect-error -- TSCONVERSION don't parse item if it's null
    activeActivity = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  activeActivity = _normalizeActivity(activeActivity);
  let overrideActivity: GlobalActivity | null = null;

  switch (activeActivity) {
    // If relaunched after a migration, go to the next activity
    // Don't need to do this for onboarding because that doesn't require a restart
    case ACTIVITY_MIGRATION:
      overrideActivity = _getNextActivity(settings, activeActivity);
      break;

    // Always check if user has been prompted to migrate or onboard
    default:
      if (!settings.hasPromptedToMigrateFromDesigner && fs.existsSync(getDesignerDataDir())) {
        trackEvent('Data', 'Migration', 'Auto');
        overrideActivity = ACTIVITY_MIGRATION;
      } else if (!settings.hasPromptedOnboarding) {
        overrideActivity = ACTIVITY_ONBOARDING;
      } else if (!settings.hasPromptedAnalytics) {
        overrideActivity = ACTIVITY_ANALYTICS;
      }

      break;
  }

  const initializeToActivity = overrideActivity || activeActivity;
  dispatch(setActiveActivity(initializeToActivity));
};

export const init = () => [
  initActiveProject(),
  initDashboardSortOrder(),
  initActiveWorkspace(),
  initActiveActivity(),
];
