/**
 * @description
 * HTTP code snippet generator for native Node.js.
 *
 * @author
 * @AhmadNassri
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

  var reqOpts = {
    method: source.method,
    hostname: source.uriObj.hostname,
    port: source.uriObj.port,
    path: source.uriObj.path,
    headers: source.allHeaders
  }

  code.push('var http = require("%s");', source.uriObj.protocol.replace(':', ''))

  code.blank()
      .push('var options = %s;', JSON.stringify(reqOpts, null, opts.indent))
      .blank()
      .push('var req = http.request(options, function (res) {')
      .push(1, 'var chunks = [];')
      .blank()
      .push(1, 'res.on("data", function (chunk) {')
      .push(2, 'chunks.push(chunk);')
      .push(1, '});')
      .blank()
      .push(1, 'res.on("end", function () {')
      .push(2, 'var body = Buffer.concat(chunks);')
      .push(2, 'console.log(body.toString());')
      .push(1, '});')
      .push('});')
      .blank()

  switch (source.postData.mimeType) {
    case 'application/x-www-form-urlencoded':
      if (source.postData.paramsObj) {
        code.unshift('var qs = require("querystring");')
        code.push('req.write(qs.stringify(%s));', util.inspect(source.postData.paramsObj, {
          depth: null
        }))
      }
      break

    case 'application/json':
      if (source.postData.jsonObj) {
        code.push('req.write(JSON.stringify(%s));', util.inspect(source.postData.jsonObj, {
          depth: null
        }))
      }
      break

    default:
      if (source.postData.text) {
        code.push('req.write(%s);', JSON.stringify(source.postData.text, null, opts.indent))
      }
  }

  code.push('req.end();')

  return code.join()
}

module.exports.info = {
  key: 'native',
  title: 'HTTP',
  link: 'http://nodejs.org/api/http.html#http_http_request_options_callback',
  description: 'Node.js native HTTP interface'
}
