const VARIABLE_SEARCH_VALUE = /{([^}]+)}/g;

export const pathWithParamsAsPathParameters = (path?: string) => path?.replace(VARIABLE_SEARCH_VALUE, ':$1') ?? '';
