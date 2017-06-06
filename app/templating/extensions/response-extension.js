import jq from 'jsonpath';
import {DOMParser} from 'xmldom';
import xpath from 'xpath';

export default {
  name: 'response',
  displayName: 'Response Value',
  description: 'reference values from other requests',
  defaultFill: "response 'body', '', ''",
  args: [
    {
      displayName: 'Attribute',
      type: 'enum',
      options: [
        {displayName: 'Body', description: 'attribute of response body', value: 'body'},
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
      hide: args => args[0].value === 'raw',
      displayName: args => {
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

  async run (context, field, id, filter) {
    if (!['body', 'header', 'raw'].includes(field)) {
      throw new Error(`Invalid response field ${field}`);
    }

    if (field !== 'raw' && !filter) {
      throw new Error(`No ${field} filter specified`);
    }

    const request = await context.models.request.getById(id);
    if (!request) {
      throw new Error(`Could not find request ${id}`);
    }

    const response = await context.models.response.getLatestForRequestId(id);

    if (!response) {
      throw new Error('No responses for request');
    }

    if (!response.statusCode || response.statusCode < 100) {
      throw new Error('No responses for request');
    }

    const sanitizedFilter = filter.trim();

    if (field === 'header') {
      return matchHeader(response.headers, sanitizedFilter);
    } else if (field === 'raw') {
      const bodyBuffer = new Buffer(response.body, response.encoding);
      return bodyBuffer.toString();
    } else if (field === 'body') {
      const bodyBuffer = new Buffer(response.body, response.encoding);
      const bodyStr = bodyBuffer.toString();

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
};

function matchJSONPath (bodyStr, query) {
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

function matchXPath (bodyStr, query) {
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

function matchHeader (headers, name) {
  const header = headers.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  );

  if (!header) {
    throw new Error(`No match for header: ${name}`);
  }

  return header.value;
}
