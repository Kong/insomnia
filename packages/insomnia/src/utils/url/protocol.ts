/**
 * Set a default protocol for a URL
 * @param url URL to set protocol on
 * @param [defaultProto='http:'] default protocol
 */
export const setDefaultProtocol = (url: string, defaultProto?: string) => {
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
