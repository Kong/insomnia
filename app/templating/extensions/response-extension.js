// @flow
import jq from 'jsonpath';
import * as xpath from '../../common/xpath';
import type {ResponseHeader} from '../../models/response';
import type {PluginTemplateTag, PluginTemplateTagContext} from './index';
import type {NunjucksParsedTagArg} from '../utils';

export default ({
  name: 'response',
  displayName: 'Response',
  description: 'reference values from other request\'s responses',
  args: [
    {
      displayName: 'Attribute',
      type: 'enum',
      options: [
        {displayName: 'Body Attribute', description: 'value of response body', value: 'body'},
        {displayName: 'Raw Body', description: 'entire response body', value: 'raw'},
        {displayName: 'Header', description: 'value of response header', value: 'header'}
      ]
    },
    {
      displayName: 'Request',
      type: 'model',
      model: 'Request'
    },
    {
      type: 'string',
      hide: (args: Array<NunjucksParsedTagArg>): boolean => args[0].value === 'raw',
      displayName: (args: Array<Object>): string => {
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
  ],

  async run (context: PluginTemplateTagContext, field: string, id: string, filter: string) {
    if (!['body', 'header', 'raw'].includes(field)) {
      throw new Error(`Invalid response field ${field}`);
    }

    if (!id) {
      throw new Error('No request specified');
    }

    if (field !== 'raw' && !filter) {
      throw new Error(`No ${field} filter specified`);
    }

    const request = await context.util.models.request.getById(id);
    if (!request) {
      throw new Error(`Could not find request ${id}`);
    }

    const response = await context.util.models.response.getLatestForRequestId(id);

    if (!response) {
      throw new Error('No responses for request');
    }

    if (!response.statusCode) {
      throw new Error('No responses for request');
    }

    const sanitizedFilter = filter.trim();

    if (field === 'header') {
      return matchHeader(response.headers, sanitizedFilter);
    } else if (field === 'raw') {
      return context.util.models.response.getBodyBuffer(response, '').toString();
    } else if (field === 'body') {
      const bodyStr = context.util.models.response.getBodyBuffer(response, '').toString();

      if (sanitizedFilter.indexOf('$') === 0) {
        return matchJSONPath(bodyStr, sanitizedFilter);
      } else if (sanitizedFilter.indexOf('/') === 0) {
        return matchXPath(bodyStr, sanitizedFilter);
      } else {
        throw new Error(`Invalid format for response query: ${sanitizedFilter}`);
      }
    } else {
      throw new Error(`Unknown field ${field}`);
    }
  }
}: PluginTemplateTag);

function matchJSONPath (bodyStr: string, query: string): string {
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

  if (typeof results[0] !== 'string') {
    return JSON.stringify(results[0]);
  } else {
    return results[0];
  }
}

function matchXPath (bodyStr: string, query: string): string {
  const results = xpath.query(bodyStr, query);

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  } else if (results.length > 1) {
    throw new Error(`Returned more than one result: ${query}`);
  }

  return results[0].inner;
}

function matchHeader (headers: Array<ResponseHeader>, name: string): string {
  if (!headers.length) {
    throw new Error(`No headers available`);
  }

  const header = headers.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );

  if (!header) {
    const names = headers.map(c => `"${c.name}"`).join(',\n\t');
    throw new Error(`No header with name "${name}".\nChoices are [\n\t${names}\n]`);
  }

  return header.value;
}
