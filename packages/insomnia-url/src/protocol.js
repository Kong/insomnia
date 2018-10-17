/**
 * Set a default protocol for a URL
 * @param url {string} - URL to set protocol on
 * @param [defaultProto='http:'] {string} - default protocol
 * @returns {string}
 */
module.exports.setDefaultProtocol = function(url, defaultProto) {
  const trimmedUrl = url.trim();
  defaultProto = defaultProto || 'http:';

  // If no url, don't bother returning anything
  if (!trimmedUrl) {
    return '';
  }

  // Default the proto if it doesn't exist
  if (trimmedUrl.indexOf('://') === -1) {
    return `${defaultProto}//${trimmedUrl}`;
  }

  return trimmedUrl;
};
