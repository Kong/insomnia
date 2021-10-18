const { JSONPath } = require('jsonpath-plus');
const iconv = require('iconv-lite');
const { query: queryXPath } = require('insomnia-xpath');

function isFilterableField(field) {
  return field !== 'raw' && field !== 'url';
}

const defaultTriggerBehaviour = 'never';

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
          {
            displayName: 'Request URL',
            description: 'Url of initiating request',
            value: 'url',
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
        encoding: 'base64',
        hide: args => !isFilterableField(args[0].value),
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
        defaultValue: defaultTriggerBehaviour,
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
            displayName: 'When Expired',
            description: 'resend when existing response has expired',
            value: 'when-expired',
          },
          {
            displayName: 'Always',
            description: 'resend request when needed',
            value: 'always',
          },
        ],
      },
      {
        displayName: 'Max age (seconds)',
        help: 'The maximum age of a response to use before it expires',
        type: 'number',
        hide: args => {
          const triggerBehavior = (args[3] && args[3].value) || defaultTriggerBehaviour;
          return triggerBehavior !== 'when-expired';
        },
        defaultValue: 60,
      },
    ],

    async run(context, field, id, filter, resendBehavior, maxAgeSeconds) {
      filter = filter || '';
      resendBehavior = (resendBehavior || defaultTriggerBehaviour).toLowerCase();

      if (!['body', 'header', 'raw', 'url'].includes(field)) {
        throw new Error(`Invalid response field ${field}`);
      }

      if (!id) {
        throw new Error('No request specified');
      }

      const request = await context.util.models.request.getById(id);
      if (!request) {
        throw new Error(`Could not find request ${id}`);
      }

      const environmentId = context.context.getEnvironmentId();
      let response = await context.util.models.response.getLatestForRequestId(id, environmentId);

      let shouldResend = false;
      switch (resendBehavior) {
        case 'no-history':
          shouldResend = !response;
          break;

        case 'when-expired':
          if (!response) {
            shouldResend = true;
          } else {
            const ageSeconds = (Date.now() - response.created) / 1000;
            shouldResend = ageSeconds > maxAgeSeconds;
          }
          break;
        
        case 'always':
          shouldResend = true;
          break;

        case 'never':
        default:
          shouldResend = false;
          break;

      }

      // Make sure we only send the request once per render so we don't have infinite recursion
      const requestChain = context.context.getExtraInfo('requestChain') || [];
      if (requestChain.some(id => id === request._id)) {
        console.log('[response tag] Preventing recursive render');
        shouldResend = false;
      }

      if (shouldResend && context.renderPurpose === 'send') {
        console.log('[response tag] Resending dependency');
        requestChain.push(request._id)
        response = await context.network.sendRequest(request, [
          { name: 'requestChain', value: requestChain }
        ]);
      }

      if (!response) {
        console.log('[response tag] No response found');
        throw new Error('No responses for request');
      }

      if (response.error) {
        console.log('[response tag] Response error ' + response.error);
        throw new Error('Failed to send dependent request ' + response.error);
      }

      if (!response.statusCode) {
        console.log('[response tag] Invalid status code ' + response.statusCode);
        throw new Error('No successful responses for request');
      }

      if (isFilterableField(field) && !filter) {
        throw new Error(`No ${field} filter specified`);
      }

      const sanitizedFilter = filter.trim();
      const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
      const match = response.contentType && response.contentType.match(/charset=([\w-]+)/);
      const charset = match && match.length >= 2 ? match[1] : 'utf-8';
      switch (field) {
        case 'header':
          return matchHeader(response.headers, sanitizedFilter);

        case 'url':
          return response.url;

        case 'raw':
          // Sometimes iconv conversion fails so fallback to regular buffer
          try {
            return iconv.decode(bodyBuffer, charset);
          } catch (err) {
            console.warn('[response] Failed to decode body', err);
            return bodyBuffer.toString();
          }

        case 'body':
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

        default:
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
    results = JSONPath({json: body, path: query});
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
    throw new Error('No headers available');
  }

  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());

  if (!header) {
    const names = headers.map(c => `"${c.name}"`).join(',\n\t');
    throw new Error(`No header with name "${name}".\nChoices are [\n\t${names}\n]`);
  }

  return header.value;
}
