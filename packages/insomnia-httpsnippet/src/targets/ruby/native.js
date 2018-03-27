'use strict'

var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  var code = new CodeBuilder()

  code.push('require \'uri\'')
      .push('require \'net/http\'')
      .blank()

  // To support custom methods we check for the supported methods
  // and if doesn't exist then we build a custom class for it
  var method = source.method.toUpperCase()
  var methods = ['GET', 'POST', 'HEAD', 'DELETE', 'PATCH', 'PUT', 'OPTIONS', 'COPY', 'LOCK', 'UNLOCK', 'MOVE', 'TRACE']
  var capMethod = method.charAt(0) + method.substring(1).toLowerCase()
  if (methods.indexOf(method) < 0) {
    code.push('class Net::HTTP::%s < Net::HTTPRequest', capMethod)
        .push('  METHOD = \'%s\'', method.toUpperCase())
        .push('  REQUEST_HAS_BODY = \'%s\'', source.postData.text ? 'true' : 'false')
        .push('  RESPONSE_HAS_BODY = true')
        .push('end')
        .blank()
  }

  code.push('url = URI("%s")', source.fullUrl)
      .blank()
      .push('http = Net::HTTP.new(url.host, url.port)')

  if (source.uriObj.protocol === 'https:') {
    code.push('http.use_ssl = true')
        .push('http.verify_mode = OpenSSL::SSL::VERIFY_NONE')
  }

  code.blank()
      .push('request = Net::HTTP::%s.new(url)', capMethod)

  var headers = Object.keys(source.allHeaders)
  if (headers.length) {
    headers.forEach(function (key) {
      code.push('request["%s"] = \'%s\'', key, source.allHeaders[key])
    })
  }

  if (source.postData.text) {
    code.push('request.body = %s', JSON.stringify(source.postData.text))
  }

  code.blank()
      .push('response = http.request(request)')
      .push('puts response.read_body')

  return code.join()
}

module.exports.info = {
  key: 'native',
  title: 'net::http',
  link: 'http://ruby-doc.org/stdlib-2.2.1/libdoc/net/http/rdoc/Net/HTTP.html',
  description: 'Ruby HTTP client'
}
