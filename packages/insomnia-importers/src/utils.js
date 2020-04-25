module.exports.setDefaults = function(obj) {
  if (!obj || !obj._type) {
    return obj;
  } else if (obj._type === 'request') {
    return module.exports.setDefaultsRequest(obj);
  } else if (obj._type === 'request_group') {
    return module.exports.setDefaultsRequestGroup(obj);
  } else if (obj._type === 'environment') {
    return module.exports.setDefaultsEnvironment(obj);
  } else {
    return obj;
  }
};

module.exports.setDefaultsRequest = function(request) {
  request.method = (request.method || 'GET').toUpperCase();
  return Object.assign(
    {
      parentId: '__WORKSPACE_ID__',
      name: 'Imported',
      url: '',
      body: '',
      method: 'GET',
      parameters: [],
      headers: [],
      authentication: {},
    },
    request,
  );
};

module.exports.setDefaultsRequestGroup = function(requestGroup) {
  return Object.assign(
    {
      parentId: '__WORKSPACE_ID__',
      name: 'Imported',
      environment: {},
    },
    requestGroup,
  );
};

module.exports.setDefaultsEnvironment = function(environment) {
  return Object.assign(
    {
      parentId: '__BASE_ENVIRONMENT_ID__',
      name: 'Imported Environment',
      data: {},
    },
    environment,
  );
};

module.exports.getDateString = function() {
  return new Date().toISOString();
};

module.exports.unthrowableParseJson = function(rawData) {
  try {
    return JSON.parse(rawData);
  } catch (err) {
    return null;
  }
};
