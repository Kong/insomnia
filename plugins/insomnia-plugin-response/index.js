const jq = require('jsonpath');
const iconv = require('iconv-lite');
const { query: queryXPath } = require('insomnia-xpath');

module.exports.templateTags = [
  {
    name: 'response',
    displayName: 'Response',
    description: "reference values from other request's responses",
    args: [
      {
        displayName: 'Attribute',
        type: 'enum',
        options: [
          {
            displayName: 'Body Attribute',
            description: 'value of response body',
            value: 'body',
          },
          {
            displayName: 'Raw Body',
            description: 'entire response body',
            value: 'raw',
          },
          {
            displayName: 'Header',
            description: 'value of response header',
            value: 'header',
          },
        ],
      },
      {
        displayName: 'Request',
        type: 'model',
        model: 'Request',
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
            default:
              return 'Filter';
          }
        },
      },
      {
        displayName: 'Trigger Behavior',
        help: 'Configure when to resend the dependent request',
        type: 'enum',
        options: [
          {
            displayName: 'Never',
            description: 'never resend request',
            value: 'never',
          },
          {
            displayName: 'No History',
            description: 'resend when no responses present',
            value: 'no-history',
          },
          {
            displayName: 'Always',
            description: 'resend request when needed',
            value: 'always',
          },
        ],
      },
    ],

    async run(context, field, id, filter, resendBehavior) {
      filter = filter || '';
      resendBehavior = (resendBehavior || 'never').toLowerCase();

      if (!['body', 'header', 'raw'].includes(field)) {
        throw new Error(`Invalid response field ${field}`);
      }

      if (!id) {
        throw new Error('No request specified');
      }

      const request = await context.util.models.request.getById(id);
      if (!request) {
        throw new Error(`Could not find request ${id}`);
      }

      let response = await context.util.models.response.getLatestForRequestId(id);

      let shouldResend = false;
      if (resendBehavior === 'always') {
        shouldResend = true;
      } else if (resendBehavior === 'no-history' && !response) {
        shouldResend = true;
      } else if (resendBehavior === 'never') {
        shouldResend = false;
      }

      // Resend dependent request if needed but only if we're rendering for a send
      if (shouldResend && (!response || context.renderPurpose === 'send')) {
        console.log('[response tag] Resending dependency');
        response = await context.network.sendRequest(request);
      }

      if (!response) {
        throw new Error('No responses for request');
      }

      if (!response.statusCode) {
        throw new Error('No successful responses for request');
      }

      if (field !== 'raw' && !filter) {
        throw new Error(`No ${field} filter specified`);
      }

      const sanitizedFilter = filter.trim();

      if (field === 'header') {
        return matchHeader(response.headers, sanitizedFilter);
      } else if (field === 'raw') {
        const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
        const match = response.contentType.match(/charset=([\w-]+)/);
        const charset = match && match.length >= 2 ? match[1] : 'utf-8';

        // Sometimes iconv conversion fails so fallback to regular buffer
        try {
          return iconv.decode(bodyBuffer, charset);
        } catch (err) {
          console.warn('[response] Failed to decode body', err);
          return bodyBuffer.toString();
        }
      } else if (field === 'body') {
        const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
        const match = response.contentType.match(/charset=([\w-]+)/);
        const charset = match && match.length >= 2 ? match[1] : 'utf-8';

        // Sometimes iconv conversion fails so fallback to regular buffer
        let body;
        try {
          body = iconv.decode(bodyBuffer, charset);
        } catch (err) {
          body = bodyBuffer.toString();
          console.warn('[response] Failed to decode body', err);
        }

        if (sanitizedFilter.indexOf('$') === 0) {
          return matchJSONPath(body, sanitizedFilter);
        } else {
          return matchXPath(body, sanitizedFilter);
        }
      } else {
        throw new Error(`Unknown field ${field}`);
      }
    },
  },
];

function matchJSONPath(bodyStr, query) {
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

function matchXPath(bodyStr, query) {
  const results = queryXPath(bodyStr, query);

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  } else if (results.length > 1) {
    throw new Error(`Returned more than one result: ${query}`);
  }

  return results[0].inner;
}

function matchHeader(headers, name) {
  if (!headers.length) {
    throw new Error(`No headers available`);
  }

  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());

  if (!header) {
    const names = headers.map(c => `"${c.name}"`).join(',\n\t');
    throw new Error(`No header with name "${name}".\nChoices are [\n\t${names}\n]`);
  }

  return header.value;
}
