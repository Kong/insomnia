const { URL } = require('url');

function validateUrl(urlString) {
  try {
    const parsedURL = new URL(urlString);
    if (!parsedURL.protocol || !parsedURL.hostname) return false;
    if (!validateScheme(parsedURL.protocol)) return false;
    if (!validateHostname(parsedURL.hostname)) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function validateScheme(scheme) {
  scheme = scheme.slice(0, -1);
  const urlSchemes = ['ftp', 'file', 'gopher', 'http', 'https', 'ws', 'wss'];
  return urlSchemes.includes(scheme);
}

function validateHostname(hostname) {
  const domainNameRegExp = new RegExp('[a-zA-Z0-9.a-zA-Z]+');
  const ipv4RegExp = new RegExp('((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(.|$)){4}');
  const ipv6RegExp = new RegExp('([0-9a-f]|:){1,4}(:([0-9a-f]{0,4})*){1,7}$');
  return domainNameRegExp.test(hostname) || ipv4RegExp.test(hostname) || ipv6RegExp.test(hostname);
}

module.exports = validateUrl;
