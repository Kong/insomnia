// @flow
import electron from 'electron';
import * as React from 'react';
import { combineReducers } from 'redux';
import fs from 'fs';
import path from 'path';
import AskModal from '../../../ui/components/modals/ask-modal';
import * as moment from 'moment';

import type { ImportRawConfig, ImportResult } from '../../../common/import';
import * as importUtils from '../../../common/import';
import AlertModal from '../../components/modals/alert-modal';
import PaymentNotificationModal from '../../components/modals/payment-notification-modal';
import LoginModal from '../../components/modals/login-modal';
import * as models from '../../../models';
import * as requestOperations from '../../../models/helpers/request-operations';
import SelectModal from '../../components/modals/select-modal';
import { showError, showModal } from '../../components/modals/index';
import * as db from '../../../common/database';
import { trackEvent } from '../../../common/analytics';
import SettingsModal, {
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../../components/modals/settings-modal';
import install from '../../../plugins/install';
import type { ForceToWorkspace } from './helpers';
import { askToImportIntoWorkspace, askToSetWorkspaceScope } from './helpers';
import { createPlugin } from '../../../plugins/create';
import { reloadPlugins } from '../../../plugins';
import { setTheme } from '../../../plugins/misc';
import type { GlobalActivity } from '../../../common/constants';
import type { Workspace, WorkspaceScope } from '../../../models/workspace';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_MIGRATION,
  ACTIVITY_ONBOARDING,
  DEPRECATED_ACTIVITY_INSOMNIA,
  isValidActivity,
} from '../../../common/constants';
import { selectSettings } from '../selectors';
import { getDesignerDataDir } from '../../../common/misc';

export const LOCALSTORAGE_PREFIX = 'insomnia::meta';

const LOGIN_STATE_CHANGE = 'global/login-state-change';
const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';
const LOAD_REQUEST_START = 'global/load-request-start';
const LOAD_REQUEST_STOP = 'global/load-request-stop';
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

function activeActivityReducer(state = null, action) {
  switch (action.type) {
    case SET_ACTIVE_ACTIVITY:
      return action.activity;
    default:
      return state;
  }
}

function activeWorkspaceReducer(state = null, action) {
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

function loadingRequestsReducer(state = {}, action) {
  switch (action.type) {
    case LOAD_REQUEST_START:
      return Object.assign({}, state, { [action.requestId]: action.time });
    case LOAD_REQUEST_STOP:
      return Object.assign({}, state, { [action.requestId]: -1 });
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

export const reducer = combineReducers({
  isLoading: loadingReducer,
  loadingRequestIds: loadingRequestsReducer,
  activeWorkspaceId: activeWorkspaceReducer,
  activeActivity: activeActivityReducer,
  isLoggedIn: loginStateChangeReducer,
});

// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function newCommand(command, args) {
  return async dispatch => {
    switch (command) {
      case COMMAND_ALERT:
        showModal(AlertModal, { title: args.title, message: args.message });
        break;
      case COMMAND_LOGIN:
        showModal(LoginModal, { title: args.title, message: args.message });
        break;
      case COMMAND_TRIAL_END:
        showModal(PaymentNotificationModal);
        break;
      case COMMAND_IMPORT_URI:
        await showModal(AlertModal, {
          title: 'Confirm Data Import',
          message: (
            <span>
              Do you really want to import <code>{args.name || args.uri}</code>?
            </span>
          ),
          addCancel: true,
        });
        dispatch(importUri(args.workspaceId, args.uri));
        break;
      case COMMAND_PLUGIN_INSTALL:
        showModal(AskModal, {
          title: 'Plugin Install',
          message: (
            <React.Fragment>
              Do you want to install <code>{args.name}</code>?
            </React.Fragment>
          ),
          yesText: 'Install',
          noText: 'Cancel',
          onDone: async isYes => {
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
            <React.Fragment>
              Do you want to install <code>{parsedTheme.displayName}</code>?
            </React.Fragment>
          ),
          yesText: 'Install',
          noText: 'Cancel',
          onDone: async isYes => {
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
            await models.settings.update(settings, { theme: parsedTheme.name });
            await reloadPlugins(true);
            await setTheme(parsedTheme.name);
            showModal(SettingsModal, TAB_INDEX_THEMES);
          },
        });
        break;
      default:
      // Nothing
    }
  };
}

export function loadStart() {
  return { type: LOAD_START };
}

export function loadStop() {
  return { type: LOAD_STOP };
}

export function loadRequestStart(requestId) {
  return { type: LOAD_REQUEST_START, requestId, time: Date.now() };
}

export function loginStateChange(loggedIn) {
  return { type: LOGIN_STATE_CHANGE, loggedIn };
}

export function loadRequestStop(requestId) {
  return { type: LOAD_REQUEST_STOP, requestId };
}

function _getNextActivity(settings: Settings, currentActivity: GlobalActivity): GlobalActivity {
  switch (currentActivity) {
    case ACTIVITY_MIGRATION:
      // Has seen the onboarding step? Go to home, otherwise go to onboarding
      return settings.hasPromptedOnboarding ? ACTIVITY_HOME : ACTIVITY_ONBOARDING;
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
export function goToNextActivity() {
  return function(dispatch, getState) {
    const state = getState();
    const { activeActivity } = state.global;

    const settings = selectSettings(state);

    const nextActivity = _getNextActivity(settings, activeActivity);

    if (nextActivity !== activeActivity) {
      dispatch(setActiveActivity(nextActivity));
    }
  };
}

/*
  Go to an explicit activity
 */
export function setActiveActivity(activity: GlobalActivity) {
  activity = _normalizeActivity(activity);

  // Don't need to await settings update
  switch (activity) {
    case ACTIVITY_MIGRATION:
      trackEvent('Data', 'Migration', 'Manual');
      models.settings.patch({ hasPromptedToMigrateFromDesigner: true });
      break;
    case ACTIVITY_ONBOARDING:
      models.settings.patch({ hasPromptedOnboarding: true });
      break;
    default:
      break;
  }

  window.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
  trackEvent('Activity', 'Change', activity);
  return { type: SET_ACTIVE_ACTIVITY, activity };
}

export function setActiveWorkspace(workspaceId: string) {
  const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
  window.localStorage.setItem(key, JSON.stringify(workspaceId));
  return { type: SET_ACTIVE_WORKSPACE, workspaceId };
}

export type ImportOptions = {
  forceToWorkspace?: ForceToWorkspace,
  forceToScope?: WorkspaceScope,
};

export function importFile(
  workspaceId: string,
  { forceToScope, forceToWorkspace }: ImportOptions = {},
) {
  return async dispatch => {
    dispatch(loadStart());

    const options = {
      title: 'Import Insomnia Data',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [
        {
          name: 'Insomnia Import',
          extensions: [
            '',
            'sh',
            'txt',
            'json',
            'har',
            'curl',
            'bash',
            'shell',
            'yaml',
            'yml',
            'wsdl',
          ],
        },
      ],
    };

    const { canceled, filePaths: paths } = await electron.remote.dialog.showOpenDialog(options);
    if (canceled) {
      // It was cancelled, so let's bail out
      dispatch(loadStop());
      return;
    }

    // Let's import all the paths!
    for (const p of paths) {
      try {
        const uri = `file://${p}`;

        const options: ImportRawConfig = {
          getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
          getWorkspaceId: askToImportIntoWorkspace(workspaceId, forceToWorkspace),
        };
        const result = await importUtils.importUri(uri, options);
        handleImportResult(result, 'The file does not contain a valid specification.');
      } catch (err) {
        showModal(AlertModal, { title: 'Import Failed', message: err + '' });
      } finally {
        dispatch(loadStop());
      }
    }
  };
}

function handleImportResult(result: ImportResult, errorMessage: string): Array<Workspace> {
  const { error, summary } = result;

  if (error) {
    showError({ title: 'Import Failed', message: errorMessage, error });
    return [];
  }

  const createdRequests =
    summary[models.request.type].length + summary[models.grpcRequest.type].length;
  models.stats.incrementRequestStats({ createdRequests: createdRequests });

  return summary[models.workspace.type] || [];
}

export function importClipBoard(
  workspaceId: string,
  { forceToScope, forceToWorkspace }: ImportOptions = {},
) {
  return async dispatch => {
    dispatch(loadStart());
    const schema = electron.clipboard.readText();
    if (!schema) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: 'Your clipboard appears to be empty.',
      });
      return;
    }
    // Let's import all the paths!
    try {
      const options: ImportRawConfig = {
        getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
        getWorkspaceId: askToImportIntoWorkspace(workspaceId, forceToWorkspace),
      };
      const result = await importUtils.importRaw(schema, options);
      handleImportResult(result, 'Your clipboard does not contain a valid specification.');
    } catch (err) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: 'Your clipboard does not contain a valid specification.',
      });
    } finally {
      dispatch(loadStop());
    }
  };
}

export function importUri(
  workspaceId: string,
  uri: string,
  { forceToScope, forceToWorkspace }: ImportOptions = {},
) {
  return async dispatch => {
    dispatch(loadStart());

    try {
      const options: ImportRawConfig = {
        getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
        getWorkspaceId: askToImportIntoWorkspace(workspaceId, forceToWorkspace),
      };
      const result = await importUtils.importUri(uri, options);
      handleImportResult(result, 'The URI does not contain a valid specification.');
    } catch (err) {
      showModal(AlertModal, { title: 'Import Failed', message: err + '' });
    } finally {
      dispatch(loadStop());
    }
  };
}

const VALUE_JSON = 'json';
const VALUE_YAML = 'yaml';
const VALUE_HAR = 'har';

function showSelectExportTypeModal(onCancel, onDone) {
  const lastFormat = window.localStorage.getItem('insomnia.lastExportFormat');

  showModal(SelectModal, {
    title: 'Select Export Type',
    value: lastFormat,
    options: [
      {
        name: 'Insomnia v4 (JSON)',
        value: VALUE_JSON,
      },
      {
        name: 'Insomnia v4 (YAML)',
        value: VALUE_YAML,
      },
      { name: 'HAR – HTTP Archive Format', value: VALUE_HAR },
    ],
    message: 'Which format would you like to export as?',
    onCancel: onCancel,
    onDone: selectedFormat => {
      window.localStorage.setItem('insomnia.lastExportFormat', selectedFormat);
      onDone(selectedFormat);
    },
  });
}

function showExportPrivateEnvironmentsModal(privateEnvNames) {
  return showModal(AskModal, {
    title: 'Export Private Environments?',
    message: `Do you want to include private environments (${privateEnvNames}) in your export?`,
  });
}

async function showSaveExportedFileDialog(exportedFileNamePrefix, selectedFormat) {
  const date = moment().format('YYYY-MM-DD');
  const name = exportedFileNamePrefix.replace(/ /g, '-');
  const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
  const dir = lastDir || electron.remote.app.getPath('desktop');

  const options = {
    title: 'Export Insomnia Data',
    buttonLabel: 'Export',
    defaultPath: path.join(dir, `${name}_${date}`),
    filters: [],
  };

  if (selectedFormat === VALUE_HAR) {
    options.filters = [
      {
        name: 'HTTP Archive 1.2',
        extensions: ['har', 'har.json', 'json'],
      },
    ];
  } else if (selectedFormat === VALUE_YAML) {
    options.filters = [{ name: 'Insomnia Export', extensions: ['yaml'] }];
  } else {
    options.filters = [{ name: 'Insomnia Export', extensions: ['json'] }];
  }

  const { filePath } = await electron.remote.dialog.showSaveDialog(options);
  return filePath || null;
}

function writeExportedFileToFileSystem(filename, jsonData, onDone) {
  // Remember last exported path
  window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));
  fs.writeFile(filename, jsonData, {}, onDone);
}

export function exportWorkspacesToFile(workspaceId = null) {
  return async dispatch => {
    dispatch(loadStart());

    showSelectExportTypeModal(
      () => dispatch(loadStop()),
      async selectedFormat => {
        const workspace = await models.workspace.getById(workspaceId);

        // Check if we want to export private environments.
        let environments;
        if (workspace) {
          const parentEnv = await models.environment.getOrCreateForWorkspace(workspace);
          environments = [parentEnv, ...(await models.environment.findByParentId(parentEnv._id))];
        } else {
          environments = await models.environment.all();
        }

        let exportPrivateEnvironments = false;
        const privateEnvironments = environments.filter(e => e.isPrivate);
        if (privateEnvironments.length) {
          const names = privateEnvironments.map(e => e.name).join(', ');
          exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
        }

        const fileNamePrefix = (workspace ? workspace.name : 'Insomnia All').replace(/ /g, '-');
        const fileName = await showSaveExportedFileDialog(fileNamePrefix, selectedFormat);
        if (!fileName) {
          // Cancelled.
          dispatch(loadStop());
          return;
        }

        let stringifiedExport;
        try {
          if (selectedFormat === VALUE_HAR) {
            stringifiedExport = await importUtils.exportWorkspacesHAR(
              workspace,
              exportPrivateEnvironments,
            );
          } else if (selectedFormat === VALUE_YAML) {
            stringifiedExport = await importUtils.exportWorkspacesData(
              workspace,
              exportPrivateEnvironments,
              'yaml',
            );
          } else {
            stringifiedExport = await importUtils.exportWorkspacesData(
              workspace,
              exportPrivateEnvironments,
              'json',
            );
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
    );
  };
}

export function exportRequestsToFile(requestIds) {
  return async dispatch => {
    dispatch(loadStart());

    showSelectExportTypeModal(
      () => dispatch(loadStop()),
      async selectedFormat => {
        const requests = [];
        const privateEnvironments = [];
        const workspaceLookup = {};
        for (const requestId of requestIds) {
          const request = await requestOperations.getById(requestId);
          if (request == null) {
            continue;
          }
          requests.push(request);

          const ancestors = await db.withAncestors(request, [
            models.workspace.type,
            models.requestGroup.type,
          ]);
          const workspace = ancestors.find(ancestor => ancestor.type === models.workspace.type);
          if (workspace == null || workspaceLookup.hasOwnProperty(workspace._id)) {
            continue;
          }
          workspaceLookup[workspace._id] = true;

          const descendants = await db.withDescendants(workspace);
          const privateEnvs = descendants.filter(
            descendant => descendant.type === models.environment.type && descendant.isPrivate,
          );
          privateEnvironments.push(...privateEnvs);
        }

        let exportPrivateEnvironments = false;
        if (privateEnvironments.length) {
          const names = privateEnvironments.map(e => e.name).join(', ');
          exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
        }

        const fileNamePrefix = 'Insomnia';
        const fileName = await showSaveExportedFileDialog(fileNamePrefix, selectedFormat);
        if (!fileName) {
          // Cancelled.
          dispatch(loadStop());
          return;
        }

        let stringifiedExport;
        try {
          if (selectedFormat === VALUE_HAR) {
            stringifiedExport = await importUtils.exportRequestsHAR(
              requests,
              exportPrivateEnvironments,
            );
          } else if (selectedFormat === VALUE_YAML) {
            stringifiedExport = await importUtils.exportRequestsData(
              requests,
              exportPrivateEnvironments,
              'yaml',
            );
          } else {
            stringifiedExport = await importUtils.exportRequestsData(
              requests,
              exportPrivateEnvironments,
              'json',
            );
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
    );
  };
}

export function initActiveWorkspace() {
  let workspaceId = null;
  try {
    const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
    const item = window.localStorage.getItem(key);
    workspaceId = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  return setActiveWorkspace(workspaceId);
}

function _migrateDeprecatedActivity(activity: GlobalActivity): GlobalActivity {
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
export function initActiveActivity() {
  return function(dispatch, getState) {
    const state = getState();
    const settings = selectSettings(state);

    // Default to home
    let activeActivity = ACTIVITY_HOME;

    try {
      const key = `${LOCALSTORAGE_PREFIX}::activity`;
      const item = window.localStorage.getItem(key);
      activeActivity = JSON.parse(item);
    } catch (e) {
      // Nothing here...
    }

    activeActivity = _normalizeActivity(activeActivity);

    let overrideActivity = null;
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
        }
        break;
    }

    const initializeToActivity = overrideActivity || activeActivity;
    dispatch(setActiveActivity(initializeToActivity));
  };
}

export function init() {
  return [initActiveWorkspace(), initActiveActivity()];
}
