const { URL } = require('url');

function validateUrl(urlString) {
  try {
    const parsedURL = new URL(urlString);
    if (!parsedURL.protocol || !parsedURL.hostname) return false;
    if (!validateScheme(parsedURL.protocol)) return false;
    console.log(parsedURL.hostname)
    if (!validateHostname(parsedURL.hostname)) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function validateScheme(scheme) {
  scheme = scheme.slice(0, -1);
  urlSchemes = getValidUrlSchemes()
  return urlSchemes.includes(scheme);
}

function validateHostname(hostname) {
  const domainNameRegExp = getDomainNameRegExp()
  const ipv4RegExp = getIPv4RegExp()
  const ipv6RegExp = getIPv6RegExp()
  return domainNameRegExp.test(hostname) || ipv4RegExp.test(hostname) || ipv6RegExp.test(hostname);
}

function getValidUrlSchemes () {
  return ['ftp', 'file', 'gopher', 'http', 'https', 'ws', 'wss'];
}

function getDomainNameRegExp () {
  return new RegExp('^([a-z0-9]+(-[a-z0-9]+)*\\.)+[a-z]{2,}$')
}

function getIPv4RegExp () {
  return new RegExp('^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$')
}

function getIPv6RegExp () {
  return new RegExp('^\\[(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\\]$')
}

module.exports = { validateUrl,
  validateScheme,
  validateHostname,
  getValidUrlSchemes,
  getDomainNameRegExp,
  getIPv4RegExp,
  getIPv6RegExp
}