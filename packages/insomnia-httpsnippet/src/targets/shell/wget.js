/**
 * @description
 * HTTP code snippet generator for the Shell using Wget.
 *
 * @author
 * @AhmadNassri
 *
 * for any questions or issues regarding the generated code snippet, please open an issue mentioning the author.
 */

'use strict'

var util = require('util')
var helpers = require('../../helpers/shell')
var CodeBuilder = require('../../helpers/code-builder')

module.exports = function (source, options) {
  var opts = util._extend({
    indent: '  ',
    short: false,
    verbose: false
  }, options)

  var code = new CodeBuilder(opts.indent, opts.indent !== false ? ' \\\n' + opts.indent : ' ')

  if (opts.verbose) {
    code.push('wget %s', opts.short ? '-v' : '--verbose')
  } else {
    code.push('wget %s', opts.short ? '-q' : '--quiet')
  }

  code.push('--method %s', helpers.quote(source.method))

  Object.keys(source.allHeaders).forEach(function (key) {
    var header = util.format('%s: %s', key, source.allHeaders[key])
    code.push('--header %s', helpers.quote(header))
  })

  if (source.postData.text) {
    code.push('--body-data ' + helpers.escape(helpers.quote(source.postData.text)))
  }

  code.push(opts.short ? '-O' : '--output-document')
      .push('- %s', helpers.quote(source.fullUrl))

  return code.join()
}

module.exports.info = {
  key: 'wget',
  title: 'Wget',
  link: 'https://www.gnu.org/software/wget/',
  description: 'a free software package for retrieving files using HTTP, HTTPS'
}
