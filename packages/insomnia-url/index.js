const protocol = require('./src/protocol');
const querystring = require('./src/querystring');
const validateUrl = require('./src/validateUrl');

module.exports = {
  setDefaultProtocol: protocol.setDefaultProtocol,
  smartEncodeUrl: querystring.smartEncodeUrl,
  joinUrlAndQueryString: querystring.joinUrlAndQueryString,
  extractQueryStringFromUrl: querystring.extractQueryStringFromUrl,
  deconstructQueryStringToParams: querystring.deconstructQueryStringToParams,
  buildQueryParameter: querystring.buildQueryParameter,
  buildQueryStringFromParams: querystring.buildQueryStringFromParams,
  validateUrl: validateUrl
};
