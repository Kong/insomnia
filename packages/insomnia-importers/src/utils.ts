import { ImportRequest } from './entities';

export const setDefaults = (obj: ImportRequest) => {
  if (!obj || !obj._type) {
    return obj;
  }

  switch (obj._type) {
    case 'request':
      return {
        parentId: '__WORKSPACE_ID__',
        name: 'Imported',
        url: '',
        body: '',
        parameters: [],
        headers: [],
        authentication: {},
        ...obj,
        method: (obj.method || 'GET').toUpperCase(),
      };

    case 'request_group':
      return {
        parentId: '__WORKSPACE_ID__',
        name: 'Imported',
        environment: {},
        ...obj,
      };

    case 'environment':
      return {
        parentId: '__BASE_ENVIRONMENT_ID__',
        name: 'Imported Environment',
        data: {},
        ...obj,
      };

    default:
      return obj;
  }
};

export const unthrowableParseJson = (rawData: string) => {
  try {
    return JSON.parse(rawData);
  } catch (err) {
    return null;
  }
};
