export const CONTENT_TYPE_JSON = 'application/json';
export const CONTENT_TYPE_XML = 'application/xml';
export const CONTENT_TYPE_TEXT = 'text/plain';
export const CONTENT_TYPE_FORM = 'application/x-www-form-urlencoded';

const contentTypeMap = {
  [CONTENT_TYPE_JSON]: 'JSON',
  [CONTENT_TYPE_XML]: 'XML',
  [CONTENT_TYPE_TEXT]: 'Plain Text',
  [CONTENT_TYPE_FORM]: 'Form Data'
};

export const CONTENT_TYPES = Object.keys(contentTypeMap);

/**
 * Get the friendly name for a given content type
 * 
 * @param contentType
 * @returns {*|string}
 */
export function getContentTypeName (contentType) {
  // TODO: Make this more robust maybe...
  return contentTypeMap[contentType] || 'Unknown';
}
