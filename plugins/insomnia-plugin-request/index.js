const { format, parse } = require('url');

/**
 * URL encode a string in a flexible way
 * @param str string to encode
 * @param ignore characters to ignore
 */
const flexibleEncodeComponent = (str = '', ignore = '') => {
  // Sometimes spaces screw things up because of url.parse
  str = str.replace(/%20/g, ' ');

  // Handle all already-encoded characters so we don't touch them
  str = str.replace(/%([0-9a-fA-F]{2})/g, '__ENC__$1');

  // Do a special encode of ignored chars, so they aren't touched.
  // This first pass, surrounds them with a special tag (anything unique
  // will work), so it can change them back later
  // Example: will replace %40 with __LEAVE_40_LEAVE__, and we'll change
  // it back to %40 at the end.
  for (const c of ignore) {
    const code = encodeURIComponent(c).replace('%', '');
    const escaped = c.replace(ESCAPE_REGEX_MATCH, '\\$&');
    const re2 = new RegExp(escaped, 'g');
    str = str.replace(re2, `__RAW__${code}`);
  }

  // Encode it
  str = encodeURIComponent(str);

  // Put back the raw version of the ignored chars
  for (const match of str.match(/__RAW__([0-9a-fA-F]{2})/g) || []) {
    const code = match.replace('__RAW__', '');
    str = str.replace(match, decodeURIComponent(`%${code}`));
  }

  // Put back the encoded version of the ignored chars
  for (const match of str.match(/__ENC__([0-9a-fA-F]{2})/g) || []) {
    const code = match.replace('__ENC__', '');
    str = str.replace(match, `%${code}`);
  }

  return str;
};
/**
 * Build a querystring parameter from a param object
 */
const buildQueryParameter = (
  param,

  /** allow empty names and values */
  strict,
) => {
  strict = strict === undefined ? true : strict;

  // Skip non-name ones in strict mode
  if (strict && !param.name) {
    return '';
  }

  // Cast number values to strings
  if (typeof param.value === 'number') {
    param.value = String(param.value);
  }

  if (!strict || param.value) {
    // Don't encode ',' in values
    const value = flexibleEncodeComponent(param.value || '').replace(/%2C/gi, ',');
    const name = flexibleEncodeComponent(param.name || '');

    return `${name}=${value}`;
  } else {
    return flexibleEncodeComponent(param.name);
  }
};
/**
 * Build a querystring from a list of name/value pairs
 */
const buildQueryStringFromParams = (
  parameters,
  /** allow empty names and values */
  strict,
) => {
  strict = strict === undefined ? true : strict;
  const items = [];
  for (const param of parameters) {
    const built = buildQueryParameter(param, strict);
    if (!built) {
      continue;
    }
    items.push(built);
  }
  return items.join('&');
};
const getJoiner = (url) => {
  url = url || '';
  return url.indexOf('?') === -1 ? '?' : '&';
};
const joinUrlAndQueryString = (url, qs) => {
  if (!qs) {
    return url;
  }
  if (!url) {
    return qs;
  }
  const [base, ...hashes] = url.split('#');
  // TODO: Make this work with URLs that have a #hash component
  const baseUrl = base || '';
  const joiner = getJoiner(base);
  const hash = hashes.length ? `#${hashes.join('#')}` : '';
  return `${baseUrl}${joiner}${qs}${hash}`;
};
const setDefaultProtocol = (url, defaultProto) => {
  const trimmedUrl = url.trim();
  defaultProto = defaultProto || 'http:';

  // If no url, don't bother returning anything
  if (!trimmedUrl) {
    return '';
  }

  // Default the proto if it doesn't exist
  if (trimmedUrl.indexOf('://') === -1) {
    return `${defaultProto}//${trimmedUrl}`;
  }

  return trimmedUrl;
};
/**
 * Deconstruct a querystring to name/value pairs
 * @param [qs] {string}
 * @param [strict=true] {boolean} - allow empty names and values
 * @returns {{name: string, value: string}[]}
 */
const deconstructQueryStringToParams = (
  qs,

  /** allow empty names and values */
  strict,
) => {
  strict = strict === undefined ? true : strict;
  const pairs = [];

  if (!qs) {
    return pairs;
  }

  const stringPairs = qs.split('&');

  for (const stringPair of stringPairs) {
    // NOTE: This only splits on first equals sign. '1=2=3' --> ['1', '2=3']
    const [encodedName, ...encodedValues] = stringPair.split('=');
    const encodedValue = encodedValues.join('=');

    let name = '';
    try {
      name = decodeURIComponent(encodedName || '');
    } catch (error) {
      // Just leave it
      name = encodedName;
    }

    let value = '';
    try {
      value = decodeURIComponent(encodedValue || '');
    } catch (error) {
      // Just leave it
      value = encodedValue;
    }

    if (strict && !name) {
      continue;
    }

    pairs.push({ name, value });
  }

  return pairs;
};
const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;
/** see list of allowed characters https://datatracker.ietf.org/doc/html/rfc3986#section-2.2 */
const RFC_3986_GENERAL_DELIMITERS = ':@'; // (unintentionally?) missing: /?#[]
/** see list of allowed characters https://datatracker.ietf.org/doc/html/rfc3986#section-2.2 */
const RFC_3986_SUB_DELIMITERS = '$+,;='; // (unintentionally?) missing: !&'()*
/** see list of allowed characters https://datatracker.ietf.org/doc/html/rfc3986#section-2.2 */
const URL_PATH_CHARACTER_WHITELIST = `${RFC_3986_GENERAL_DELIMITERS}${RFC_3986_SUB_DELIMITERS}`;
/**
 * Automatically encode the path and querystring components
 * @param url url to encode
 * @param encode enable encoding
 */
const smartEncodeUrl = (url, encode) => {
  // Default autoEncode = true if not passed
  encode = encode === undefined ? true : encode;
  const urlWithProto = setDefaultProtocol(url);
  if (!encode) {
    return urlWithProto;
  } else {
    // Parse the URL into components
    const parsedUrl = parse(urlWithProto);
    // ~~~~~~~~~~~ //
    // 1. Pathname //
    // ~~~~~~~~~~~ //
    if (parsedUrl.pathname) {
      const segments = parsedUrl.pathname.split('/');
      parsedUrl.pathname = segments
        .map(s => flexibleEncodeComponent(s, URL_PATH_CHARACTER_WHITELIST))
        .join('/');
    }
    // ~~~~~~~~~~~~~~ //
    // 2. Querystring //
    // ~~~~~~~~~~~~~~ //
    if (parsedUrl.query) {
      const qsParams = deconstructQueryStringToParams(parsedUrl.query);
      const encodedQsParams = [];
      for (const { name, value } of qsParams) {
        encodedQsParams.push({
          name: flexibleEncodeComponent(name),
          value: flexibleEncodeComponent(value),
        });
      }
      parsedUrl.query = buildQueryStringFromParams(encodedQsParams);
      parsedUrl.search = `?${parsedUrl.query}`;
    }
    return format(parsedUrl);
  }
};

module.exports.templateTags = [
  {
    name: 'request',
    displayName: 'Request',
    description: 'reference value from current request',
    args: [
      {
        displayName: 'Attribute',
        type: 'enum',
        options: [
          {
            displayName: 'Name',
            value: 'name',
            description: 'name of request',
          },
          {
            displayName: 'Folder',
            value: 'folder',
            description: 'name of parent folder (or workspace)',
          },
          {
            displayName: 'URL',
            value: 'url',
            description: 'fully qualified URL',
          },
          {
            displayName: 'Query Parameter',
            value: 'parameter',
            description: 'query parameter by name',
          },
          {
            displayName: 'Header',
            value: 'header',
            description: 'header value by name',
          },
          {
            displayName: 'Cookie',
            value: 'cookie',
            description: 'cookie value by name',
          },
          {
            displayName: 'OAuth 2.0 Access Token',
            value: 'oauth2',
            /*
              This value is left as is and not renamed to 'oauth2-access' so as to not
              break the current release's usage of `oauth2`.
            */
          },
          {
            displayName: 'OAuth 2.0 Identity Token',
            value: 'oauth2-identity',
          },
          {
            displayName: 'OAuth 2.0 Refresh Token',
            value: 'oauth2-refresh',
          },
        ],
      },
      {
        type: 'string',
        hide: args =>
          ['url', 'oauth2', 'oauth2-identity', 'oauth2-refresh', 'name', 'folder'].includes(
            args[0].value,
          ),
        displayName: args => {
          switch (args[0].value) {
            case 'cookie':
              return 'Cookie Name';
            case 'parameter':
              return 'Query Parameter Name';
            case 'header':
              return 'Header Name';
            default:
              return 'Name';
          }
        },
      },
      {
        hide: args => args[0].value !== 'folder',
        displayName: 'Parent Index',
        help: 'Specify an index (Starting at 0) for how high up the folder tree to look',
        type: 'number',
      },
    ],

    async run(context, attribute, name, folderIndex) {
      const { meta } = context;

      if (!meta.requestId || !meta.workspaceId) {
        return null;
      }

      const request = await context.util.models.request.getById(meta.requestId);
      const workspace = await context.util.models.workspace.getById(meta.workspaceId);

      if (!request) {
        throw new Error(`Request not found for ${meta.requestId}`);
      }

      if (!workspace) {
        throw new Error(`Workspace not found for ${meta.workspaceId}`);
      }

      switch (attribute) {
        case 'url':
          return getRequestUrl(context, request);
        case 'cookie':
          if (!name) {
            throw new Error('No cookie specified');
          }

          const cookieJar = await context.util.models.cookieJar.getOrCreateForWorkspace(workspace);
          const url = await getRequestUrl(context, request);
          return getCookieValue(cookieJar, url, name);
        case 'parameter':
          if (!name) {
            throw new Error('No query parameter specified');
          }

          const parameterNames = [];

          if (request.parameters.length === 0) {
            throw new Error('No query parameters available');
          }

          for (const queryParameter of request.parameters) {
            const queryParameterName = await context.util.render(queryParameter.name);
            parameterNames.push(queryParameterName);
            if (queryParameterName.toLowerCase() === name.toLowerCase()) {
              return context.util.render(queryParameter.value);
            }
          }

          const parameterNamesStr = parameterNames.map(n => `"${n}"`).join(',\n\t');
          throw new Error(
            `No query parameter with name "${name}".\nChoices are [\n\t${parameterNamesStr}\n]`,
          );
        case 'header':
          if (!name) {
            throw new Error('No header specified');
          }

          const headerNames = [];

          if (request.headers.length === 0) {
            throw new Error('No headers available');
          }

          for (const header of request.headers) {
            const headerName = await context.util.render(header.name);
            headerNames.push(headerName);
            if (headerName.toLowerCase() === name.toLowerCase()) {
              return context.util.render(header.value);
            }
          }

          const headerNamesStr = headerNames.map(n => `"${n}"`).join(',\n\t');
          throw new Error(`No header with name "${name}".\nChoices are [\n\t${headerNamesStr}\n]`);
        case 'oauth2':
          const access = await context.util.models.oAuth2Token.getByRequestId(request._id);
          if (!access || !access.accessToken) {
            throw new Error('No OAuth 2.0 access tokens found for request');
          }
          return access.accessToken;
        case 'oauth2-identity':
          const identity = await context.util.models.oAuth2Token.getByRequestId(request._id);
          if (!identity || !identity.identityToken) {
            throw new Error('No OAuth 2.0 identity tokens found for request');
          }
          return identity.identityToken;
        case 'oauth2-refresh':
          const refresh = await context.util.models.oAuth2Token.getByRequestId(request._id);
          if (!refresh || !refresh.refreshToken) {
            throw new Error('No OAuth 2.0 refresh tokens found for request');
          }
          return refresh.refreshToken;
        case 'name':
          return request.name;
        case 'folder':
          const ancestors = await context.util.models.request.getAncestors(request);
          const doc = ancestors[folderIndex || 0];
          if (!doc) {
            throw new Error(
              `Could not get folder by index ${folderIndex}. Must be between 0-${ancestors.length -
              1}`,
            );
          }
          return doc ? doc.name : null;
      }

      return null;
    },
  },
];

async function getRequestUrl(context, request) {
  const url = await context.util.render(request.url);
  const parameters = [];
  for (const p of request.parameters) {
    parameters.push({
      name: await context.util.render(p.name),
      value: await context.util.render(p.value),
    });
  }

  const qs = buildQueryStringFromParams(parameters);
  const finalUrl = joinUrlAndQueryString(url, qs);

  return smartEncodeUrl(finalUrl, request.settingEncodeUrl);
}
const { CookieJar } = require('tough-cookie');
/**
 * Get a request.jar() from a list of cookie objects
 */
const jarFromCookies = (cookies) => {
  let jar;
  try {
    // For some reason, fromJSON modifies `cookies`.
    // Create a copy first just to be sure.
    const copy = JSON.stringify({ cookies });
    jar = CookieJar.fromJSON(copy);
  } catch (error) {
    console.log('[cookies] Failed to initialize cookie jar', error);
    jar = new CookieJar();
  }
  jar.rejectPublicSuffixes = false;
  jar.looseMode = true;
  return jar;
};
function getCookieValue(cookieJar, url, name) {
  return new Promise((resolve, reject) => {
    const jar = jarFromCookies(cookieJar.cookies);

    jar.getCookies(url, {}, (err, cookies) => {
      if (err) {
        console.warn(`Failed to find cookie for ${url}`, err);
      }

      if (!cookies || cookies.length === 0) {
        reject(new Error(`No cookies in store for url "${url}"`));
      }

      const cookie = cookies.find(cookie => cookie.key === name);
      if (!cookie) {
        const names = cookies.map(c => `"${c.key}"`).join(',\n\t');
        throw new Error(
          `No cookie with name "${name}".\nChoices are [\n\t${names}\n] for url "${url}"`,
        );
      } else {
        resolve(cookie ? cookie.value : null);
      }
    });
  });
}
