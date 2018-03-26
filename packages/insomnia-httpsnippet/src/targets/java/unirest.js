/**
 * @description
 * HTTP code snippet generator for Java using Unirest.
 *
 * @author
 * @shashiranjan84
 *
 * for any questions or issues regarding the generated code snippet, please open an issue mentioning the author.
 */

'use strict'

var util = require('util')
var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  var opts = util._extend({
    indent: '  '
  }, options)

  var code = new CodeBuilder(opts.indent)

  var methods = [ 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS' ]

  if (methods.indexOf(source.method.toUpperCase()) === -1) {
    code.push('HttpResponse<String> response = Unirest.customMethod("%s","%s")', source.method.toUpperCase(), source.fullUrl)
  } else {
    code.push('HttpResponse<String> response = Unirest.%s("%s")', source.method.toLowerCase(), source.fullUrl)
  }

  // Add headers, including the cookies
  var headers = Object.keys(source.allHeaders)

  // construct headers
  if (headers.length) {
    headers.forEach(function (key) {
      code.push(1, '.header("%s", "%s")', key, source.allHeaders[key])
    })
  }

  if (source.postData.text) {
    code.push(1, '.body(%s)', JSON.stringify(source.postData.text))
  }

  code.push(1, '.asString();')

  return code.join()
}

module.exports.info = {
  key: 'unirest',
  title: 'Unirest',
  link: 'http://unirest.io/java.html',
  description: 'Lightweight HTTP Request Client Library'
}
