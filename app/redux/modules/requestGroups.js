
import {show} from './modals'
import {MODAL_ENVIRONMENT_EDITOR, MODAL_REQUEST_GROUP_RENAME} from '../../lib/constants'

export const REQUEST_GROUP_TOGGLE = 'request-groups/toggle';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

// Nothing yet...


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function toggle (requestGroup) {
  return {type: REQUEST_GROUP_TOGGLE, requestGroup}
}

export function showUpdateNamePrompt (requestGroup) {
  const defaultValue = requestGroup.name;
  return show(MODAL_REQUEST_GROUP_RENAME, {defaultValue, requestGroup});
}

export function showEnvironmentEditModal (requestGroup) {
  return show(MODAL_ENVIRONMENT_EDITOR, {requestGroup});
}

