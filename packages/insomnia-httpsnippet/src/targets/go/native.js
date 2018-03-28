/**
 * @description
 * HTTP code snippet generator for native Go.
 *
 * @author
 * @montanaflynn
 *
 * for any questions or issues regarding the generated code snippet, please open an issue mentioning the author.
 */

'use strict'

var util = require('util')
var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  // Let's Go!
  var code = new CodeBuilder('\t')

  // Define Options
  var opts = util._extend({
    showBoilerplate: true,
    checkErrors: false,
    printBody: true,
    timeout: -1
  }, options)

  var errorPlaceholder = opts.checkErrors ? 'err' : '_'

  var indent = opts.showBoilerplate ? 1 : 0

  var errorCheck = function () {
    if (opts.checkErrors) {
      code.push(indent, 'if err != nil {')
        .push(indent + 1, 'panic(err)')
        .push(indent, '}')
    }
  }

  // Create boilerplate
  if (opts.showBoilerplate) {
    code.push('package main')
      .blank()
      .push('import (')
      .push(indent, '"fmt"')

    if (opts.timeout > 0) {
      code.push(indent, '"time"')
    }

    if (source.postData.text) {
      code.push(indent, '"strings"')
    }

    code.push(indent, '"net/http"')

    if (opts.printBody) {
      code.push(indent, '"io/ioutil"')
    }

    code.push(')')
      .blank()
      .push('func main() {')
      .blank()
  }

  // Create client
  var client
  if (opts.timeout > 0) {
    client = 'client'
    code.push(indent, 'client := http.Client{')
      .push(indent + 1, 'Timeout: time.Duration(%s * time.Second),', opts.timeout)
      .push(indent, '}')
      .blank()
  } else {
    client = 'http.DefaultClient'
  }

  code.push(indent, 'url := "%s"', source.fullUrl)
    .blank()

  // If we have body content or not create the var and reader or nil
  if (source.postData.text) {
    code.push(indent, 'payload := strings.NewReader(%s)', JSON.stringify(source.postData.text))
      .blank()
      .push(indent, 'req, %s := http.NewRequest("%s", url, payload)', errorPlaceholder, source.method)
      .blank()
  } else {
    code.push(indent, 'req, %s := http.NewRequest("%s", url, nil)', errorPlaceholder, source.method)
      .blank()
  }

  errorCheck()

  // Add headers
  if (Object.keys(source.allHeaders).length) {
    Object.keys(source.allHeaders).forEach(function (key) {
      code.push(indent, 'req.Header.Add("%s", "%s")', key, source.allHeaders[key])
    })

    code.blank()
  }

  // Make request
  code.push(indent, 'res, %s := %s.Do(req)', errorPlaceholder, client)
  errorCheck()

  // Get Body
  if (opts.printBody) {
    code.blank()
      .push(indent, 'defer res.Body.Close()')
      .push(indent, 'body, %s := ioutil.ReadAll(res.Body)', errorPlaceholder)
    errorCheck()
  }

  // Print it
  code.blank()
    .push(indent, 'fmt.Println(res)')

  if (opts.printBody) {
    code.push(indent, 'fmt.Println(string(body))')
  }

  // End main block
  if (opts.showBoilerplate) {
    code.blank()
      .push('}')
  }

  return code.join()
}

module.exports.info = {
  key: 'native',
  title: 'NewRequest',
  link: 'http://golang.org/pkg/net/http/#NewRequest',
  description: 'Golang HTTP client request'
}
