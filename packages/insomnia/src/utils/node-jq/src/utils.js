import isPathValid from 'is-valid-path';

export const INVALID_PATH_ERROR =
  'node-jq: invalid path argument supplied (not a valid path)';
export const INVALID_JSON_PATH_ERROR =
  'node-jq: invalid path argument supplied (not a .json file)';

export const isJSONPath = path => {
  return /\.json|.jsonl$/.test(path);
};

export const validateJSONPath = path => {
  if (!isPathValid(path)) {
    throw new Error(`${INVALID_PATH_ERROR}: "${path}"`);
  }

  if (!isJSONPath(path)) {
    throw new Error(`${INVALID_JSON_PATH_ERROR}: "${path === '' ? '' : path}"`);
  }

  return true;
};
