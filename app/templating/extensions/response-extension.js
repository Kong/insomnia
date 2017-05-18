import jq from 'jsonpath';
import {DOMParser} from 'xmldom';
import xpath from 'xpath';
import * as models from '../../models';

import BaseExtension from './base/base-extension';

export default class ResponseExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['response'];
  }

  async run (context, field, id, query) {
    if (field !== 'body') {
      throw new Error(`Invalid response field ${field}`);
    }

    const request = await models.request.getById(id);
    if (!request) {
      throw new Error(`Could not find request ${id}`);
    }

    const response = await models.response.getLatestForRequest(id);

    if (!response) {
      throw new Error(`No responses for request ${id}`);
    }

    const bodyBuffer = new Buffer(response.body, response.encoding);
    const bodyStr = bodyBuffer.toString();

    if (query.indexOf('$') === 0) {
      return this.matchJSONPath(bodyStr, query);
    } else if (query.indexOf('/') === 0) {
      return this.matchXPath(bodyStr, query);
    } else {
      throw new Error(`Invalid format for response query: ${query}`);
    }
  }

  matchJSONPath (bodyStr, query) {
    let body;
    let results;

    try {
      body = JSON.parse(bodyStr);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }

    try {
      results = jq.query(body, query);
    } catch (err) {
      throw new Error(`Invalid JSONPath query: ${query}`);
    }

    if (results.length === 0) {
      throw new Error(`Returned no results: ${query}`);
    } else if (results.length > 1) {
      throw new Error(`Returned more than one result: ${query}`);
    }

    return results[0];
  }

  matchXPath (bodyStr, query) {
    let results;

    // This will never throw
    const dom = new DOMParser().parseFromString(bodyStr);

    try {
      results = xpath.select(query, dom);
    } catch (err) {
      throw new Error(`Invalid XPath query: ${query}`);
    }

    if (results.length === 0) {
      throw new Error(`Returned no results: ${query}`);
    } else if (results.length > 1) {
      throw new Error(`Returned more than one result: ${query}`);
    }

    return results[0].childNodes.toString();
  }
}
