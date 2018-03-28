'use strict'

var convert = function (obj, indent, last_indent) {
  var i, result

  if (!last_indent) {
    last_indent = ''
  }

  switch (Object.prototype.toString.call(obj)) {
    case '[object Null]':
      result = 'null'
      break

    case '[object Undefined]':
      result = 'null'
      break

    case '[object String]':
      result = "'" + obj.replace(/\\/g, '\\\\').replace(/\'/g, "\'") + "'"
      break

    case '[object Number]':
      result = obj.toString()
      break

    case '[object Array]':
      result = []

      obj.forEach(function (item) {
        result.push(convert(item, indent + indent, indent))
      })

      result = 'array(\n' + indent + result.join(',\n' + indent) + '\n' + last_indent + ')'
      break

    case '[object Object]':
      result = []
      for (i in obj) {
        if (obj.hasOwnProperty(i)) {
          result.push(convert(i, indent) + ' => ' + convert(obj[i], indent + indent, indent))
        }
      }
      result = 'array(\n' + indent + result.join(',\n' + indent) + '\n' + last_indent + ')'
      break

    default:
      result = 'null'
  }

  return result
}

module.exports = {
  convert: convert,
  methods: [
    'ACL',
    'BASELINE_CONTROL',
    'CHECKIN',
    'CHECKOUT',
    'CONNECT',
    'COPY',
    'DELETE',
    'GET',
    'HEAD',
    'LABEL',
    'LOCK',
    'MERGE',
    'MKACTIVITY',
    'MKCOL',
    'MKWORKSPACE',
    'MOVE',
    'OPTIONS',
    'POST',
    'PROPFIND',
    'PROPPATCH',
    'PUT',
    'REPORT',
    'TRACE',
    'UNCHECKOUT',
    'UNLOCK',
    'UPDATE',
    'VERSION_CONTROL'
  ]
}
