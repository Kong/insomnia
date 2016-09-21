'use strict';

module.exports.CONTENT_TYPE_JSON = 'application/json';
module.exports.CONTENT_TYPE_XML = 'application/xml';
module.exports.CONTENT_TYPE_TEXT = 'text/plain';
module.exports.CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';
module.exports.CONTENT_TYPE_OTHER = '';

const contentTypeMap = {
  [module.exports.CONTENT_TYPE_JSON]: 'JSON',
  [module.exports.CONTENT_TYPE_XML]: 'XML',
  [module.exports.CONTENT_TYPE_FORM_URLENCODED]: 'Form Encoded',
  [module.exports.CONTENT_TYPE_TEXT]: 'Plain Text',
  [module.exports.CONTENT_TYPE_OTHER]: 'Other'
};

module.exports.CONTENT_TYPES = Object.keys(contentTypeMap);

/**
 * Get the friendly name for a given content type
 *
 * @param contentType
 * @returns {*|string}
 */
module.exports.getContentTypeName = contentType => {
  return contentTypeMap[contentType] || contentTypeMap[module.exports.CONTENT_TYPE_OTHER];
};

module.exports.getContentTypeFromHeaders = headers => {
  const header = headers.find(({name}) => name.toLowerCase() === 'content-type');
  return header ? header.value : null;
};
