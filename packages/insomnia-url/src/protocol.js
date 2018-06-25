/**
 * Set a default protocol for a URL
 * @param url {string} - URL to set protocol on
 * @param [defaultProto='http:'] {string} - default protocol
 * @returns {string}
 */
module.exports.setDefaultProtocol = function(url, defaultProto) {
  defaultProto = defaultProto || 'http:';

  // If no url, don't bother returning anything
  if (!url) {
    return '';
  }

  // Default the proto if it doesn't exist
  if (url.indexOf('://') === -1) {
    url = `${defaultProto}//${url}`;
  }

  return url;
};
