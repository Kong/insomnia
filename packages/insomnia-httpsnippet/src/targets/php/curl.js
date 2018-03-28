/**
 * @description
 * HTTP code snippet generator for PHP using curl-ext.
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
    closingTag: false,
    indent: '  ',
    maxRedirects: 10,
    namedErrors: false,
    noTags: false,
    shortTags: false,
    timeout: 30
  }, options)

  var code = new CodeBuilder(opts.indent)

  if (!opts.noTags) {
    code.push(opts.shortTags ? '<?' : '<?php')
      .blank()
  }

  code.push('$curl = curl_init();')
    .blank()

  var curlOptions = [{
    escape: true,
    name: 'CURLOPT_PORT',
    value: source.uriObj.port
  }, {
    escape: true,
    name: 'CURLOPT_URL',
    value: source.fullUrl
  }, {
    escape: false,
    name: 'CURLOPT_RETURNTRANSFER',
    value: 'true'
  }, {
    escape: true,
    name: 'CURLOPT_ENCODING',
    value: ''
  }, {
    escape: false,
    name: 'CURLOPT_MAXREDIRS',
    value: opts.maxRedirects
  }, {
    escape: false,
    name: 'CURLOPT_TIMEOUT',
    value: opts.timeout
  }, {
    escape: false,
    name: 'CURLOPT_HTTP_VERSION',
    value: source.httpVersion === 'HTTP/1.0' ? 'CURL_HTTP_VERSION_1_0' : 'CURL_HTTP_VERSION_1_1'
  }, {
    escape: true,
    name: 'CURLOPT_CUSTOMREQUEST',
    value: source.method
  }, {
    escape: true,
    name: 'CURLOPT_POSTFIELDS',
    value: source.postData ? source.postData.text : undefined
  }]

  code.push('curl_setopt_array($curl, array(')

  var curlopts = new CodeBuilder(opts.indent, '\n' + opts.indent)

  curlOptions.forEach(function (option) {
    if (!~[null, undefined].indexOf(option.value)) {
      curlopts.push(util.format('%s => %s,', option.name, option.escape ? JSON.stringify(option.value) : option.value))
    }
  })

  // construct cookies
  var cookies = source.cookies.map(function (cookie) {
    return encodeURIComponent(cookie.name) + '=' + encodeURIComponent(cookie.value)
  })

  if (cookies.length) {
    curlopts.push(util.format('CURLOPT_COOKIE => "%s",', cookies.join('; ')))
  }

  // construct cookies
  var headers = Object.keys(source.headersObj).sort().map(function (key) {
    return util.format('"%s: %s"', key, source.headersObj[key])
  })

  if (headers.length) {
    curlopts.push('CURLOPT_HTTPHEADER => array(')
      .push(1, headers.join(',\n' + opts.indent + opts.indent))
      .push('),')
  }

  code.push(1, curlopts.join())
    .push('));')
    .blank()
    .push('$response = curl_exec($curl);')
    .push('$err = curl_error($curl);')
    .blank()
    .push('curl_close($curl);')
    .blank()
    .push('if ($err) {')

  if (opts.namedErrors) {
    code.push(1, 'echo array_flip(get_defined_constants(true)["curl"])[$err];')
  } else {
    code.push(1, 'echo "cURL Error #:" . $err;')
  }

  code.push('} else {')
    .push(1, 'echo $response;')
    .push('}')

  if (!opts.noTags && opts.closingTag) {
    code.blank()
      .push('?>')
  }

  return code.join()
}

module.exports.info = {
  key: 'curl',
  title: 'cURL',
  link: 'http://php.net/manual/en/book.curl.php',
  description: 'PHP with ext-curl'
}
