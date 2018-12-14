const xpath = require('xpath');
const { DOMParser } = require('xmldom');

/**
 * Query an XML blob with XPath
 * @param xml {string}
 * @param query {string}
 * @returns {Array<{outer: string, inner: string}>}
 */
module.exports.query = function(xml, query) {
  const dom = new DOMParser().parseFromString(xml);
  let rawResults = [];

  try {
    rawResults = xpath.select(query, dom);
  } catch (err) {
    throw new Error(`Invalid XPath query: ${query}`);
  }

  const results = [];

  // Functions return plain strings
  if (typeof rawResults === 'string') {
    results.push({
      outer: rawResults,
      inner: rawResults,
    });
  } else {
    for (const result of rawResults || []) {
      if (result.constructor.name === 'Attr') {
        results.push({
          outer: result.toString().trim(),
          inner: result.nodeValue,
        });
      } else if (result.constructor.name === 'Element') {
        results.push({
          outer: result.toString().trim(),
          inner: result.childNodes.toString(),
        });
      }
    }
  }

  return results;
};
