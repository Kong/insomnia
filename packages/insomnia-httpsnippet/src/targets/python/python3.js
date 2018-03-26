/**
 * @description
 * HTTP code snippet generator for native Python3.
 *
 * @author
 * @montanaflynn
 *
 * for any questions or issues regarding the generated code snippet, please open an issue mentioning the author.
 */

'use strict'

var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  var code = new CodeBuilder()
  // Start Request
  code.push('import http.client')
      .blank()

  // Check which protocol to be used for the client connection
  var protocol = source.uriObj.protocol
  if (protocol === 'https:') {
    code.push('conn = http.client.HTTPSConnection("%s")', source.uriObj.host)
        .blank()
  } else {
    code.push('conn = http.client.HTTPConnection("%s")', source.uriObj.host)
        .blank()
  }

  // Create payload string if it exists
  var payload = JSON.stringify(source.postData.text)
  if (payload) {
    code.push('payload = %s', payload)
        .blank()
  }

  // Create Headers
  var header
  var headers = source.allHeaders
  var headerCount = Object.keys(headers).length
  if (headerCount === 1) {
    for (header in headers) {
      code.push('headers = { \'%s\': "%s" }', header, headers[header])
          .blank()
    }
  } else if (headerCount > 1) {
    var count = 1

    code.push('headers = {')

    for (header in headers) {
      if (count++ !== headerCount) {
        code.push('    \'%s\': "%s",', header, headers[header])
      } else {
        code.push('    \'%s\': "%s"', header, headers[header])
      }
    }

    code.push('    }')
        .blank()
  }

  // Make Request
  var method = source.method
  var path = source.uriObj.path
  if (payload && headerCount) {
    code.push('conn.request("%s", "%s", payload, headers)', method, path)
  } else if (payload && !headerCount) {
    code.push('conn.request("%s", "%s", payload)', method, path)
  } else if (!payload && headerCount) {
    code.push('conn.request("%s", "%s", headers=headers)', method, path)
  } else {
    code.push('conn.request("%s", "%s")', method, path)
  }

  // Get Response
  code.blank()
      .push('res = conn.getresponse()')
      .push('data = res.read()')
      .blank()
      .push('print(data.decode("utf-8"))')

  return code.join()
}

module.exports.info = {
  key: 'python3',
  title: 'http.client',
  link: 'https://docs.python.org/3/library/http.client.html',
  description: 'Python3 HTTP Client'
}
