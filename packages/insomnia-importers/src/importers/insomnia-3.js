'use strict';

module.exports.id = 'insomnia-3';
module.exports.name = 'Insomnia v3';
module.exports.description = 'Insomnia export format 3';

module.exports.convert = function(rawData) {
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (e) {
    return null;
  }

  if (data.__export_format !== 3) {
    // Bail early if it's not the legacy format
    return null;
  }

  // This is the target export format so nothing needs to change
  return data.resources;
};
