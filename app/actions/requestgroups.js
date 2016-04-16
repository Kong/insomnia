import * as types from '../constants/actionTypes'
import {REQUEST_GROUP_RENAME} from '../constants/modals';
import {ENVIRONMENT_EDITOR} from '../constants/modals';
import * as modals from './modals';

export function update (requestGroup) {
  return {type: types.REQUEST_GROUP_UPDATE, requestGroup};
}

export function remove (requestGroup) {
  return {type: types.REQUEST_GROUP_DELETE, requestGroup};
}

export function toggle (requestGroup) {
  return {type: types.REQUEST_GROUP_TOGGLE, requestGroup}
}

export function showUpdateNamePrompt (requestGroup) {
  const defaultValue = requestGroup.name;
  return modals.show(REQUEST_GROUP_RENAME, {defaultValue, requestGroup});
}

export function showEnvironmentEditModal () {
  return modals.show(ENVIRONMENT_EDITOR);
}
