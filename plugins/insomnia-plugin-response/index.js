const { Cookie } = require('tough-cookie');
const { JSONPath } = require('jsonpath-plus');
const iconv = require('iconv-lite');

const AttributeType = {
  Body: 'body',
  Raw: 'raw',
  Header: 'header',
  Cookie: 'cookie',
  Url: 'url',
};

function isValidResponseFieldType(field) {
  return Object.values(AttributeType).includes(field);
}

function isFilterableField(field) {
  return [
    AttributeType.Body,
    AttributeType.Header,
    AttributeType.Cookie,
  ].includes(field);
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
            value: AttributeType.Body,
          },
          {
            displayName: 'Raw Body',
            description: 'entire response body',
            value: AttributeType.Raw,
          },
          {
            displayName: 'Header',
            description: 'value of response header',
            value: AttributeType.Header,
          },
          {
            displayName: 'Cookie',
            description: 'value of response cookie',
            value: AttributeType.Cookie,
          },
          {
            displayName: 'Request URL',
            description: 'Url of initiating request',
            value: AttributeType.Url,
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
        hide: (args) => !isFilterableField(args[0].value),
        displayName: (args) => {
          switch (args[0].value) {
            case AttributeType.Body:
              return 'Filter (JSONPath or XPath)';
            case AttributeType.Header:
              return 'Header Name';
            case AttributeType.Cookie:
              return 'Cookie name';
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
        hide: (args) => {
          const triggerBehavior =
            (args[3] && args[3].value) || defaultTriggerBehaviour;
          return triggerBehavior !== 'when-expired';
        },
        defaultValue: 60,
      },
    ],

    async run(context, field, id, filter, resendBehavior, maxAgeSeconds) {
      if (!isValidResponseFieldType(field)) {
        throw new Error(`Invalid response field ${field}`);
      }

      const request = await getRequest(context, id);
      let response = await getResponse(
        context,
        request,
        resendBehavior,
        maxAgeSeconds
      );

      filter = filter || '';
      if (isFilterableField(field) && !filter) {
        throw new Error(`No ${field} filter specified`);
      }

      const sanitizedFilter = filter.trim();
      const bodyBuffer = context.util.models.response.getBodyBuffer(
        response,
        ''
      );
      const match =
        response.contentType && response.contentType.match(/charset=([\w-]+)/);
      const charset = match && match.length >= 2 ? match[1] : 'utf-8';
      switch (field) {
        case AttributeType.Header:
          return matchHeader(response.headers, sanitizedFilter);

        case AttributeType.Url:
          return response.url;

        case AttributeType.Cookie:
          return matchCookie(response, filter);

        case AttributeType.Raw:
          // Sometimes iconv conversion fails so fallback to regular buffer
          try {
            return iconv.decode(bodyBuffer, charset);
          } catch (err) {
            console.warn('[response] Failed to decode body', err);
            return bodyBuffer.toString();
          }

        case AttributeType.Body:
          // Sometimes iconv conversion fails so fallback to regular buffer
          let body;
          try {
            body = iconv.decode(bodyBuffer, charset);
          } catch (err) {
            console.warn('[response] Failed to decode body', err);
            body = bodyBuffer.toString();
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

/**
 * @typedef {any} Context
 */

/**
 * @typedef {Object} Request
 * @property {string} _id
 */

/**
 * @typedef {Object} Response
 * @property {string?} contentType
 * @property {string?} url
 * @property {{name: string; value:string}[]} headers
 */

/**
 * Get selected request
 *
 * @param {Context} context
 * @param {string} id
 * @returns {Promise<Request?>}
 */
async function getRequest(context, id) {
  if (!id) {
    throw new Error('No request specified');
  }

  const request = await context.util.models.request.getById(id);
  if (!request) {
    throw new Error(`Could not find request ${id}`);
  }
  return request;
}

/**
 * Get cached response, or send a new request and return the response
 *
 * @param {Context} context
 * @param {Request} request
 * @param {string?} resendBehavior
 * @param {number} maxAgeSeconds
 * @returns {Promise<Response?>}
 */
async function getResponse(context, request, resendBehavior, maxAgeSeconds) {
  resendBehavior = (resendBehavior || defaultTriggerBehaviour).toLowerCase();

  const environmentId = context.context.getEnvironmentId();
  let response = await context.util.models.response.getLatestForRequestId(
    request._id,
    environmentId
  );

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

  if (shouldResend && context.renderPurpose === 'send') {
    // Make sure we only send the request once per render so we don't have infinite recursion
    const requestChain = context.context.getExtraInfo('requestChain') || [];
    if (requestChain.some((id) => id === request._id)) {
      console.log('[response tag] Preventing recursive render');
    } else {
      console.log('[response tag] Resending dependency');
      requestChain.push(request._id);
      response = await context.network.sendRequest(request, [
        { name: 'requestChain', value: requestChain },
      ]);
    }
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
  return response;
}

/**
 * Get the value of a cookie from the response
 *
 * @param {Response} response
 * @param {string} name
 * @returns {string}
 */
function matchCookie(response, name) {
  if (!name) {
    throw new Error('No cookie specified');
  }

  const cookies = getCookies(response);
  if (!cookies.size) {
    throw new Error('No cookies set for response');
  }

  const cookie = cookies.get(name);
  if (!cookie) {
    const names = formatChoices(Array.from(cookies.keys()));
    throw new Error(`No cookie with name "${name}".\nChoices are ${names}`);
  }
  return cookie.value;
}

/**
 * Parse cookies from request and return as a Map
 *
 * @param {Response} response
 * @returns {Map<string, Cookie>}
 */
function getCookies(response) {
  const cookies = new Map();
  response.headers
    ?.filter((h) => h.name.toLowerCase() == 'set-cookie')
    .map((h) => Cookie.parse(h.value))
    .forEach((c) => {
      if (c) {
        cookies.set(c.key, c);
      }
    });
  return cookies;
}

/**
 * @param {string} bodyStr
 * @param {string} query
 */
function matchJSONPath(bodyStr, query) {
  let body;
  let results;

  try {
    body = JSON.parse(bodyStr);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }

  try {
    results = JSONPath({ json: body, path: query });
  } catch (err) {
    throw new Error(`Invalid JSONPath query: ${query}`);
  }

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  }

  if (results.length > 1) {
    return JSON.stringify(results);
  }

  if (typeof results[0] !== 'string') {
    return JSON.stringify(results[0]);
  } else {
    return results[0];
  }
}

/**
 * @param {string} bodyStr
 * @param {string} query
 */
function matchXPath(bodyStr, query) {
  const results = queryXPath(bodyStr, query);

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  } else if (results.length > 1) {
    throw new Error(`Returned more than one result: ${query}`);
  }

  return results[0].inner;
}

/**
 * @param {Response['headers']} headers
 * @param {string} name
 */
function matchHeader(headers, name) {
  if (!headers.length) {
    throw new Error('No headers available');
  }

  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );

  if (!header) {
    const names = formatChoices(headers.map((c) => c.name));
    throw new Error(`No header with name "${name}".\nChoices are ${names}`);
  }

  return header.value;
}

/**
 * Query an XML blob with XPath
 *
 * @param {string} xml
 * @param {string} query
 */
const queryXPath = (xml, query) => {
  const DOMParser = require('xmldom').DOMParser;
  const dom = new DOMParser().parseFromString(xml);
  let selectedValues = [];
  if (query === undefined) {
    throw new Error('Must pass an XPath query.');
  }
  try {
    selectedValues = require('xpath').select(query, dom);
  } catch (err) {
    throw new Error(`Invalid XPath query: ${query}`);
  }
  const output = [];
  // Functions return plain strings
  if (typeof selectedValues === 'string') {
    output.push({
      outer: selectedValues,
      inner: selectedValues,
    });
  } else {
    for (const selectedValue of selectedValues || []) {
      switch (selectedValue.constructor.name) {
        case 'Attr':
          output.push({
            outer: selectedValue.toString().trim(),
            inner: selectedValue.nodeValue,
          });
          break;

        case 'Element':
          output.push({
            outer: selectedValue.toString().trim(),
            inner: selectedValue.childNodes.toString(),
          });
          break;

        case 'Text':
          output.push({
            outer: selectedValue.toString().trim(),
            inner: selectedValue.toString().trim(),
          });
          break;

        default:
          break;
      }
    }
  }
  return output;
};

/**
 * Format an array of choices into a consitent format
 *
 * @param {string[]} choices
 * @return {string}
 */
function formatChoices(choices) {
  const names = choices.map((c) => `"${c}"`).join(',\n\t');
  return `[\n\t${names}\n]`;
}
