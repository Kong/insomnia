const pathParameters = require('./src/path-parameters');
const protocol = require('./src/protocol');
const querystring = require('./src/querystring');

module.exports = {
  insertPathParameters: pathParameters.insertPathParameters,
  setDefaultProtocol: protocol.setDefaultProtocol,
  smartEncodeUrl: querystring.smartEncodeUrl,
  joinUrlAndQueryString: querystring.joinUrlAndQueryString,
  extractQueryStringFromUrl: querystring.extractQueryStringFromUrl,
  deconstructQueryStringToParams: querystring.deconstructQueryStringToParams,
  buildQueryParameter: querystring.buildQueryParameter,
  buildQueryStringFromParams: querystring.buildQueryStringFromParams,
};
