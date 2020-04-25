'use strict';

module.exports.id = 'insomnia-2';
module.exports.name = 'Insomnia v2';
module.exports.description = 'Insomnia export format 2';

module.exports.convert = function(rawData) {
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (e) {
    return null;
  }

  if (data.__export_format !== 2) {
    // Bail early if it's not the legacy format
    return null;
  }

  // The only difference between 2 and 3 is the request body object
  for (const resource of data.resources) {
    if (resource._type !== 'request') {
      continue;
    }

    // Convert old String request bodies to new (HAR) schema
    const headers = resource.headers || [];
    const contentTypeHeader = headers.find(h => h.name.toLowerCase() === 'content-type');
    const mimeType = contentTypeHeader ? contentTypeHeader.value.split(';')[0] : null;
    resource.body = {
      mimeType: mimeType || '',
      text: resource.body,
    };
  }

  return data.resources;
};
