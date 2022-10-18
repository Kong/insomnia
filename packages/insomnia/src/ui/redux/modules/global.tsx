import { format } from 'date-fns';
import fs, { NoParamCallback } from 'fs';
import path from 'path';
import React, { Fragment } from 'react';
import { combineReducers, Dispatch } from 'redux';
import { unreachableCase } from 'ts-assert-unreachable';

import { trackPageView } from '../../../common/analytics';
import type { DashboardSortOrder, GlobalActivity } from '../../../common/constants';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  isValidActivity,
} from '../../../common/constants';
import { database } from '../../../common/database';
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
import { WebSocketRequest } from '../../../models/websocket-request';
import { isWorkspace, Workspace } from '../../../models/workspace';
import { reloadPlugins } from '../../../plugins';
import { createPlugin } from '../../../plugins/create';
import { setTheme } from '../../../plugins/misc';
import { exchangeCodeForToken } from '../../../sync/git/github-oauth-provider';
import { exchangeCodeForGitLabToken } from '../../../sync/git/gitlab-oauth-provider';
import { AskModal } from '../../../ui/components/modals/ask-modal';
import { AlertModal } from '../../components/modals/alert-modal';
import { showAlert, showError, showModal } from '../../components/modals/index';
import { currentLoginModalHandle, LoginModalHandle } from '../../components/modals/login-modal';
import { SelectModal } from '../../components/modals/select-modal';
import {
  SettingsModal,
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../../components/modals/settings-modal';
import { selectStats } from '../selectors';
import { RootState } from '.';
import { importUri } from './import';
import { activateWorkspace } from './workspace';

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
export const SET_IS_FINISHED_BOOTING = 'global/is-finished-booting';
const COMMAND_ALERT = 'app/alert';
const COMMAND_LOGIN = 'app/auth/login';
const COMMAND_IMPORT_URI = 'app/import';
const COMMAND_PLUGIN_INSTALL = 'plugins/install';
const COMMAND_PLUGIN_THEME = 'plugins/theme';
export const COMMAND_GITHUB_OAUTH_AUTHENTICATE = 'oauth/github/authenticate';
export const COMMAND_GITLAB_OAUTH_AUTHENTICATE = 'oauth/gitlab/authenticate';
export const COMMAND_FINISH_AUTHENTICATION = 'app/auth/finish';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //
const isFinishedBootingReducer = (state = false, action: any) => {
  switch (action.type) {
    case SET_IS_FINISHED_BOOTING:
      return action.payload;

    default:
      return state;
  }
};

function activeActivityReducer(state: string | null = null, action: any) {
  switch (action.type) {
    case SET_ACTIVE_ACTIVITY:
      return action.activity;

    default:
      return state;
  }
}

function activeProjectReducer(state: string = DEFAULT_PROJECT_ID, action: any) {
  switch (action.type) {
    case SET_ACTIVE_PROJECT:
      return action.projectId;

    default:
      return state;
  }
}

function dashboardSortOrderReducer(state: DashboardSortOrder = 'modified-desc', action: any) {
  switch (action.type) {
    case SET_DASHBOARD_SORT_ORDER:
      return action.payload.sortOrder;

    default:
      return state;
  }
}

function activeWorkspaceReducer(state: string | null = null, action: any) {
  switch (action.type) {
    case SET_ACTIVE_WORKSPACE:
      return action.workspaceId;

    default:
      return state;
  }
}

function loadingReducer(state = false, action: any) {
  switch (action.type) {
    case LOAD_START:
      return true;

    case LOAD_STOP:
      return false;

    default:
      return state;
  }
}

function loadingRequestsReducer(state: Record<string, number> = {}, action: any) {
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

function loginStateChangeReducer(state = false, action: any) {
  switch (action.type) {
    case LOGIN_STATE_CHANGE:
      return action.loggedIn;

    default:
      return state;
  }
}

export interface GlobalState {
  isFinishedBooting: boolean;
  isLoading: boolean;
  activeProjectId: string;
  dashboardSortOrder: DashboardSortOrder;
  activeWorkspaceId: string | null;
  activeActivity: GlobalActivity | null;
  isLoggedIn: boolean;
  loadingRequestIds: Record<string, number>;
}

export const reducer = combineReducers<GlobalState>({
  isFinishedBooting: isFinishedBootingReducer,
  isLoading: loadingReducer,
  dashboardSortOrder: dashboardSortOrderReducer,
  loadingRequestIds: loadingRequestsReducer,
  activeProjectId: activeProjectReducer,
  activeWorkspaceId: activeWorkspaceReducer,
  activeActivity: activeActivityReducer,
  isLoggedIn: loginStateChangeReducer,
});

export const selectIsLoading = (state: RootState) => state.global.isLoading;

// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //
const setIsFinishedBooting = (isFinishedBooting: boolean) => ({
  type: SET_IS_FINISHED_BOOTING,
  payload: isFinishedBooting,
});

export const newCommand = (command: string, args: any) => async (dispatch: Dispatch<any>) => {
  switch (command) {
    case COMMAND_ALERT:
      showModal(AlertModal, {
        title: args.title,
        message: args.message,
      });
      break;

    case COMMAND_LOGIN:
      showModal(LoginModalHandle, {
        title: args.title,
        message: args.message,
        reauth: true,
      });
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
            await window.main.installPlugin(args.name);
            showModal(SettingsModal, { tab: TAB_INDEX_PLUGINS });
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
          showModal(SettingsModal, { tab: TAB_INDEX_THEMES });
        },
      });
      break;

    case COMMAND_GITHUB_OAUTH_AUTHENTICATE: {
      await exchangeCodeForToken(args).catch((error: Error) => {
        showError({
          error,
          title: 'Error authorizing GitHub',
          message: error.message,
        });
      });
      break;
    }

    case COMMAND_GITLAB_OAUTH_AUTHENTICATE: {
      await exchangeCodeForGitLabToken(args).catch((error: Error) => {
        showError({
          error,
          title: 'Error authorizing GitLab',
          message: error.message,
        });
      });
      break;
    }

    case COMMAND_FINISH_AUTHENTICATION: {
      if (currentLoginModalHandle) {
        currentLoginModalHandle?.submitAuthCode(args.box);
      } else {
        console.log(`Received auth box, but no login modal... ${command}`);
      }
      break;
    }

    case null:
      break;

    default: {
      console.log(`Unknown command: ${command}`);
    }
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

/*
  Go to an explicit activity
 */
export const setActiveActivity = (activity: GlobalActivity) => {
  activity = _normalizeActivity(activity);
  window.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(activity));
  trackPageView(activity);
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

const showSelectExportTypeModal = ({ onDone }: {
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
  const date = format(Date.now(), 'yyyy-MM-dd');
  const name = exportedFileNamePrefix.replace(/ /g, '-');
  const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
  const dir = lastDir || window.app.getPath('desktop');
  const options = {
    title: 'Export Insomnia Data',
    buttonLabel: 'Export',
    defaultPath: `${path.join(dir, `${name}_${date}`)}.${selectedFormat}`,
  };
  const { filePath } = await window.dialog.showSaveDialog(options);
  return filePath || null;
};

const writeExportedFileToFileSystem = (filename: string, jsonData: string, onDone: NoParamCallback) => {
  // Remember last exported path
  window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));
  fs.writeFile(filename, jsonData, {}, onDone);
};

export const exportAllToFile = (activeProjectName: string, workspacesForActiveProject: Workspace[]) => {
  if (!workspacesForActiveProject.length) {
    showAlert({
      title: 'Cannot export',
      message: <>There are no workspaces to export in the <strong>{activeProjectName}</strong> {strings.project.singular.toLowerCase()}.</>,
    });
    return;
  }

  showSelectExportTypeModal({
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
        return;
      }

      let stringifiedExport;

      try {
        switch (selectedFormat) {
          case VALUE_HAR:
            stringifiedExport = await exportWorkspacesHAR(workspacesForActiveProject, exportPrivateEnvironments);
            break;

          case VALUE_YAML:
            stringifiedExport = await exportWorkspacesData(workspacesForActiveProject, exportPrivateEnvironments, 'yaml');
            break;

          case VALUE_JSON:
            stringifiedExport = await exportWorkspacesData(workspacesForActiveProject, exportPrivateEnvironments, 'json');
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
        return;
      }

      writeExportedFileToFileSystem(fileName, stringifiedExport, err => {
        if (err) {
          console.warn('Export failed', err);
        }
      });
    },
  });
};

export const exportRequestsToFile = (requestIds: string[]) => {
  showSelectExportTypeModal({
    onDone: async selectedFormat => {
      const requests: (GrpcRequest | Request | WebSocketRequest)[] = [];
      const privateEnvironments: Environment[] = [];
      const workspaceLookup: any = {};

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
        const names = privateEnvironments.map(privateEnvironment => privateEnvironment.name).join(', ');
        exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
      }

      const fileName = await showSaveExportedFileDialog({
        exportedFileNamePrefix: 'Insomnia',
        selectedFormat,
      });

      if (!fileName) {
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
        return;
      }

      writeExportedFileToFileSystem(fileName, stringifiedExport, err => {
        if (err) {
          console.warn('Export failed', err);
        }
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    // Nothing here...
  }

  return setActiveWorkspace(workspaceId);
}

function _normalizeActivity(activity: GlobalActivity): GlobalActivity {
  if (isValidActivity(activity)) {
    return activity;
  }

  const fallbackActivity = ACTIVITY_HOME;
  console.log(`[app] invalid activity "${activity}"; navigating to ${fallbackActivity}`);
  return fallbackActivity;
}

/*
  Initialize with the cached active activity, and navigate to the next activity if necessary
  This will also decide whether to start with the migration
 */
export const initActiveActivity = () => (dispatch: any, getState: any) => {
  const state = getState();
  // Default to home
  let activeActivity = ACTIVITY_HOME;

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activity`;
    const item = window.localStorage.getItem(key);
    // @ts-expect-error -- TSCONVERSION don't parse item if it's null
    activeActivity = JSON.parse(item);
  } catch (error) {
    // Nothing here...
  }

  const initializeToActivity = _normalizeActivity(activeActivity);
  if (initializeToActivity === state.global.activeActivity) {
    // no need to dispatch the action twice if it has already been set to the correct value.
    return;
  }
  dispatch(setActiveActivity(initializeToActivity));
};

export const initFirstLaunch = () => async (dispatch: any, getState: any) => {
  const state = getState();

  const stats = selectStats(state);
  if (stats.launches > 1) {
    dispatch(setIsFinishedBooting(true));
    return;
  }

  const workspace = await models.workspace.create({
    scope: 'design',
    name: `New ${strings.document.singular}`,
    parentId: DEFAULT_PROJECT_ID,
  });
  const { _id: workspaceId } = workspace;

  await models.workspace.ensureChildren(workspace);
  const request = await models.request.create({ parentId: workspaceId });

  const unitTestSuite = await models.unitTestSuite.create({
    parentId: workspaceId,
    name: 'Example Test Suite',
  });

  await models.workspaceMeta.updateByParentId(workspaceId, {
    activeRequestId: request._id,
    activeActivity: ACTIVITY_DEBUG,
    activeUnitTestSuiteId: unitTestSuite._id,
  });

  dispatch(activateWorkspace({ workspaceId }));
  dispatch(setActiveActivity(ACTIVITY_DEBUG));
  dispatch(setIsFinishedBooting(true));
};

export const init = () => [
  initActiveProject(),
  initDashboardSortOrder(),
  initActiveWorkspace(),
  initActiveActivity(),
  initFirstLaunch(),
];
