import jq from 'jsonpath';
import {DOMParser} from 'xmldom';
import xpath from 'xpath';
import * as models from '../../models';

import BaseExtension from './base/base-extension';

export default class ResponseExtension extends BaseExtension {
  getName () {
    return 'Response Value';
  }

  getTag () {
    return 'response';
  }

  getDescription () {
    return 'reference values from other requests';
  }

  getDefaultFill () {
    return "response 'body', '', ''";
  }

  getArguments () {
    return [
      {
        key: 'field',
        label: 'Attribute',
        type: 'enum',
        options: [
          {name: 'Body', description: 'attribute of response body', value: 'body'},
          {name: 'Raw Body', description: 'entire response body', value: 'raw'},
          {name: 'Header', description: 'value of response header', value: 'header'}
        ]
      },
      {
        key: 'request',
        label: 'Request',
        type: 'model',
        model: 'Request'
      },
      {
        key: 'filter',
        type: 'string',
        hide: args => args[0].value === 'raw',
        label: args => {
          switch (args[0].value) {
            case 'body':
              return 'Filter (JSONPath or XPath)';
            case 'header':
              return 'Header Name';
            default :
              return 'Filter';
          }
        }
      }
    ];
  }

  async run (context, field, id, filter) {
    if (!['body', 'header', 'raw'].includes(field)) {
      throw new Error(`Invalid response field ${field}`);
    }

    if (field !== 'raw' && !filter) {
      throw new Error(`No ${field} filter specified`);
    }

    const request = await models.request.getById(id);
    if (!request) {
      throw new Error(`Could not find request ${id}`);
    }

    const response = await models.response.getLatestForRequest(id);

    if (!response) {
      throw new Error('No responses for request');
    }

    if (!response.statusCode || response.statusCode < 100) {
      throw new Error('No responses for request');
    }

    const sanitizedFilter = filter.trim();

    if (field === 'header') {
      return this.matchHeader(response.headers, sanitizedFilter);
    } else if (field === 'raw') {
      const bodyBuffer = new Buffer(response.body, response.encoding);
      return bodyBuffer.toString();
    } else if (field === 'body') {
      const bodyBuffer = new Buffer(response.body, response.encoding);
      const bodyStr = bodyBuffer.toString();

      if (sanitizedFilter.indexOf('$') === 0) {
        return this.matchJSONPath(bodyStr, sanitizedFilter);
      } else if (sanitizedFilter.indexOf('/') === 0) {
        return this.matchXPath(bodyStr, sanitizedFilter);
      } else {
        throw new Error(`Invalid format for response query: ${sanitizedFilter}`);
      }
    } else {
      throw new Error(`Unknown field ${field}`);
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

  matchHeader (headers, name) {
    const header = headers.find(
      h => h.name.toLowerCase() === name.toLowerCase()
    );

    if (!header) {
      throw new Error(`No match for header: ${name}`);
    }

    return header.value;
  }
}
