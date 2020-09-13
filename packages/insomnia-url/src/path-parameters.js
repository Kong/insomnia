/**
 * Insert path parameters into the templating within the url
 * @param url {string} - URL to insert path parameters into
 * @param pathParameters {{name: string, value: string}[]}
 * @returns {string}
 */
module.exports.insertPathParameters = function(url, pathParameters) {
  for (const pathParam of pathParameters) {
    url = url.replace(`:${pathParam.name}`, pathParam.value);
  }

  return url;
};
