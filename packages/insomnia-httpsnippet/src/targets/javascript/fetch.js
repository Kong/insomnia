/**
 * @description
 * HTTP code snippet generator for the browser Fetch API
 *
 * @author
 * @peoplenarthax
 *
 * for any questions or issues regarding the generated code snippet, please open an issue mentioning the author.
 */

'use strict';

var util = require('util');
var CodeBuilder = require('../../helpers/code-builder');

module.exports = function(source, options) {
  var opts = util._extend(
    {
      indent: '  ',
    },
    options,
  );

  var code = new CodeBuilder(opts.indent);

  var url = source.fullUrl;
  var fetchOptions = {
    mode: 'cors',
    method: source.method,
    headers: source.allHeaders,
  };

  switch (source.postData.mimeType) {
    case 'application/x-www-form-urlencoded':
      fetchOptions.body = source.postData.paramsObj
        ? source.postData.paramsObj
        : source.postData.text;
      break;

    case 'application/json':
      fetchOptions.body = source.postData.text;
      break;

    case 'multipart/form-data':
      code.push('let form = new FormData();');

      source.postData.params.forEach(function(param) {
        code.push(
          'form.append(%s, %s);',
          JSON.stringify(param.name),
          JSON.stringify(param.value || param.fileName || ''),
        );
      });
      delete fetchOptions.headers;
      fetchOptions.body = '[form]';

      code.blank();
      break;

    default:
      if (source.postData.text) {
        fetchOptions.data = source.postData.text;
      }
  }

  code
    .push(
      'const fetchOptions = ' +
        JSON.stringify(fetchOptions, null, opts.indent).replace('"[form]"', 'form'),
    )
    .blank()
    .push('fetch("' + url + '", fetchOptions)')
    .push(1, '.then(response => response.json())')
    .push(1, '.then(data => console.log(data));');

  return code.join();
};

module.exports.info = {
  key: 'fetch',
  title: 'Fetch API',
  link: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
  description: 'Browser API that offers a simple interface for fetching resources',
};
