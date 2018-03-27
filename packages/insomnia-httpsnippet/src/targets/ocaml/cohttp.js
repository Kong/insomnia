/**
 * @description
 * HTTP code snippet generator for OCaml using CoHTTP.
 *
 * @author
 * @SGrondin
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

  var methods = ['get', 'post', 'head', 'delete', 'patch', 'put', 'options']
  var code = new CodeBuilder(opts.indent)

  code.push('open Cohttp_lwt_unix')
      .push('open Cohttp')
      .push('open Lwt')
      .blank()
      .push('let uri = Uri.of_string "%s" in', source.fullUrl)

  // Add headers, including the cookies
  var headers = Object.keys(source.allHeaders)

  if (headers.length === 1) {
    code.push('let headers = Header.add (Header.init ()) "%s" "%s" in', headers[0], source.allHeaders[headers[0]])
  } else if (headers.length > 1) {
    code.push('let headers = Header.add_list (Header.init ()) [')

    headers.forEach(function (key) {
      code.push(1, '("%s", "%s");', key, source.allHeaders[key])
    })

    code.push('] in')
  }

  // Add body
  if (source.postData.text) {
    // Just text
    code.push('let body = Cohttp_lwt_body.of_string %s in', JSON.stringify(source.postData.text))
  }

  // Do the request
  code.blank()

  code.push('Client.call %s%s%s uri',
    headers.length ? '~headers ' : '',
    source.postData.text ? '~body ' : '',
    (methods.indexOf(source.method.toLowerCase()) >= 0 ? ('`' + source.method.toUpperCase()) : '(Code.method_of_string "' + source.method + '")')
  )

  // Catch result
  code.push('>>= fun (res, body_stream) ->')
      .push(1, '(* Do stuff with the result *)')

  return code.join()
}

module.exports.info = {
  key: 'cohttp',
  title: 'CoHTTP',
  link: 'https://github.com/mirage/ocaml-cohttp',
  description: 'Cohttp is a very lightweight HTTP server using Lwt or Async for OCaml'
}
