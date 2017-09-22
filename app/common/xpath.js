// @flow
import xpath from 'xpath';
import {DOMParser} from 'xmldom';

export function query (xml: string, query: string): Array<{outer: string, inner: string}> {
  const dom = new DOMParser().parseFromString(xml);
  let rawResults = [];

  try {
    rawResults = xpath.select(query, dom);
  } catch (err) {
    throw new Error(`Invalid XPath query: ${query}`);
  }

  const results = [];
  for (const result of rawResults || []) {
    if (result.constructor.name === 'Attr') {
      results.push({
        outer: result.toString().trim(),
        inner: result.nodeValue
      });
    } else if (result.constructor.name === 'Element') {
      results.push({
        outer: result.toString().trim(),
        inner: result.childNodes.toString()
      });
    }
  }

  return results;
}
