export const CONTENT_TYPE_JSON = 'application/json';
export const CONTENT_TYPE_XML = 'application/xml';
export const CONTENT_TYPE_TEXT = 'text/plain';
export const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';
export const CONTENT_TYPE_OTHER = '';

const contentTypeMap = {
  [CONTENT_TYPE_JSON]: 'JSON',
  [CONTENT_TYPE_XML]: 'XML',
  [CONTENT_TYPE_TEXT]: 'Text',
  [CONTENT_TYPE_OTHER]: 'Other',
  [CONTENT_TYPE_FORM_URLENCODED]: 'Form URL Encoded'
};

export const CONTENT_TYPES = Object.keys(contentTypeMap);

/**
 * Get the friendly name for a given content type
 * 
 * @param contentType
 * @returns {*|string}
 */
export function getContentTypeName (contentType) {
  return contentTypeMap[contentType] || contentTypeMap[CONTENT_TYPE_OTHER];
}

export function getContentTypeFromHeaders (headers) {
  const header = headers.find(({name}) => name.toLowerCase() === 'content-type');
  return header ? header.value : null;
}
