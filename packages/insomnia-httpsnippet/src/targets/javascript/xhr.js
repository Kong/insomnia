/**
 * @description
 * HTTP code snippet generator for native XMLHttpRequest
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
    indent: '  ',
    cors: true
  }, options)

  var code = new CodeBuilder(opts.indent)

  switch (source.postData.mimeType) {
    case 'application/json':
      code.push('var data = JSON.stringify(%s);', JSON.stringify(source.postData.jsonObj, null, opts.indent))
          .push(null)
      break

    case 'multipart/form-data':
      code.push('var data = new FormData();')

      source.postData.params.forEach(function (param) {
        code.push('data.append(%s, %s);', JSON.stringify(param.name), JSON.stringify(param.value || param.fileName || ''))
      })

      // remove the contentType header
      if (source.allHeaders['content-type'].indexOf('boundary')) {
        delete source.allHeaders['content-type']
      }

      code.blank()
      break

    default:
      code.push('var data = %s;', JSON.stringify(source.postData.text || null))
          .blank()
  }

  code.push('var xhr = new XMLHttpRequest();')

  if (opts.cors) {
    code.push('xhr.withCredentials = true;')
  }

  code.blank()
      .push('xhr.addEventListener("readystatechange", function () {')
      .push(1, 'if (this.readyState === this.DONE) {')
      .push(2, 'console.log(this.responseText);')
      .push(1, '}')
      .push('});')
      .blank()
      .push('xhr.open(%s, %s);', JSON.stringify(source.method), JSON.stringify(source.fullUrl))

  Object.keys(source.allHeaders).forEach(function (key) {
    code.push('xhr.setRequestHeader(%s, %s);', JSON.stringify(key), JSON.stringify(source.allHeaders[key]))
  })

  code.blank()
      .push('xhr.send(data);')

  return code.join()
}

module.exports.info = {
  key: 'xhr',
  title: 'XMLHttpRequest',
  link: 'https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest',
  description: 'W3C Standard API that provides scripted client functionality'
}
