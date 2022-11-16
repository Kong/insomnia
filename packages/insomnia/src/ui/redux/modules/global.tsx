import { combineReducers } from 'redux';

import type { DashboardSortOrder, GlobalActivity } from '../../../common/constants';
import {
  ACTIVITY_HOME,
  isValidActivity,
} from '../../../common/constants';
import { DEFAULT_PROJECT_ID } from '../../../models/project';
import { trackPageView } from '../../analytics';

export const LOCALSTORAGE_PREFIX = 'insomnia::meta';
const LOGIN_STATE_CHANGE = 'global/login-state-change';
export const SET_ACTIVE_PROJECT = 'global/activate-project';
export const SET_DASHBOARD_SORT_ORDER = 'global/dashboard-sort-order';
export const SET_ACTIVE_WORKSPACE = 'global/activate-workspace';
export const SET_ACTIVE_ACTIVITY = 'global/activate-activity';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //
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

function loginStateChangeReducer(state = false, action: any) {
  switch (action.type) {
    case LOGIN_STATE_CHANGE:
      return action.loggedIn;

    default:
      return state;
  }
}

export interface GlobalState {
  activeProjectId: string;
  dashboardSortOrder: DashboardSortOrder;
  activeWorkspaceId: string | null;
  activeActivity: GlobalActivity | null;
  isLoggedIn: boolean;
}

export const reducer = combineReducers<GlobalState>({
  dashboardSortOrder: dashboardSortOrderReducer,
  activeProjectId: activeProjectReducer,
  activeWorkspaceId: activeWorkspaceReducer,
  activeActivity: activeActivityReducer,
  isLoggedIn: loginStateChangeReducer,
});

// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //
export const loginStateChange = (loggedIn: boolean) => ({
  type: LOGIN_STATE_CHANGE,
  loggedIn,
});

/*
  Go to an explicit activity
 */
export const setActiveActivity = (activity: GlobalActivity) => {
  activity = isValidActivity(activity) ? activity : ACTIVITY_HOME;
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
