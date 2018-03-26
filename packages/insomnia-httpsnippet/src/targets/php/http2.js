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
var helpers = require('./helpers')
var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  var opts = util._extend({
    closingTag: false,
    indent: '  ',
    noTags: false,
    shortTags: false
  }, options)

  var code = new CodeBuilder(opts.indent)
  var hasBody = false

  if (!opts.noTags) {
    code.push(opts.shortTags ? '<?' : '<?php')
        .blank()
  }

  code.push('$client = new http\\Client;')
      .push('$request = new http\\Client\\Request;')
      .blank()

  switch (source.postData.mimeType) {
    case 'application/x-www-form-urlencoded':
      code.push('$body = new http\\Message\\Body;')
          .push('$body->append(new http\\QueryString(%s));', helpers.convert(source.postData.paramsObj, opts.indent))
          .blank()
      hasBody = true
      break

    case 'multipart/form-data':
      var files = []
      var fields = {}

      source.postData.params.forEach(function (param) {
        if (param.fileName) {
          files.push({
            name: param.name,
            type: param.contentType,
            file: param.fileName,
            data: param.value
          })
        } else if (param.value) {
          fields[param.name] = param.value
        }
      })

      code.push('$body = new http\\Message\\Body;')
          .push('$body->addForm(%s, %s);',
            Object.keys(fields).length ? helpers.convert(fields, opts.indent) : 'NULL',
            files.length ? helpers.convert(files, opts.indent) : 'NULL'
          )

      // remove the contentType header
      if (~source.headersObj['content-type'].indexOf('boundary')) {
        delete source.headersObj['content-type']
      }

      code.blank()

      hasBody = true
      break

    default:
      if (source.postData.text) {
        code.push('$body = new http\\Message\\Body;')
            .push('$body->append(%s);', helpers.convert(source.postData.text))
            .blank()
        hasBody = true
      }
  }

  code.push('$request->setRequestUrl(%s);', helpers.convert(source.url))
      .push('$request->setRequestMethod(%s);', helpers.convert(source.method))

  if (hasBody) {
    code.push('$request->setBody($body);')
        .blank()
  }

  if (Object.keys(source.queryObj).length) {
    code.push('$request->setQuery(new http\\QueryString(%s));', helpers.convert(source.queryObj, opts.indent))
        .blank()
  }

  if (Object.keys(source.headersObj).length) {
    code.push('$request->setHeaders(%s);', helpers.convert(source.headersObj, opts.indent))
        .blank()
  }

  if (Object.keys(source.cookiesObj).length) {
    code.blank()
        .push('$client->setCookies(%s);', helpers.convert(source.cookiesObj, opts.indent))
        .blank()
  }

  code.push('$client->enqueue($request)->send();')
      .push('$response = $client->getResponse();')
      .blank()
      .push('echo $response->getBody();')

  if (!opts.noTags && opts.closingTag) {
    code.blank()
        .push('?>')
  }

  return code.join()
}

module.exports.info = {
  key: 'http2',
  title: 'HTTP v2',
  link: 'http://devel-m6w6.rhcloud.com/mdref/http',
  description: 'PHP with pecl/http v2'
}
