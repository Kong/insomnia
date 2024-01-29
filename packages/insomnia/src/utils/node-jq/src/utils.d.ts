export const INVALID_PATH_ERROR =
    'node-jq: invalid path argument supplied (not a valid path)';
export const INVALID_JSON_PATH_ERROR =
    'node-jq: invalid path argument supplied (not a .json file)';

export function isJSONPath(path: any): boolean;

export function validateJSONPath(path: any): boolean;
