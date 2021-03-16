'use strict';

module.exports.id = 'postman-environment';
module.exports.name = 'Postman Environment';
module.exports.description = 'Importer for Postman environments';

module.exports.convert = function(rawData) {
  let data;
  try {
    data = JSON.parse(rawData);
    if (data._postman_variable_scope === 'environment') {
      return importEnvironment(data);
    }
  } catch (e) {
    // Nothing
  }

  return null;
};

function importEnvironment(environment) {
  const newEnvironment = {
    _id: '__ENV_1__',
    _type: 'environment',
    name: environment.name || 'Postman Environment',
    data: {},
  };

  for (const value of environment.values) {
    if (!value.enabled) {
      continue;
    }

    newEnvironment.data[value.key] = value.value;
  }

  return [newEnvironment];
}
