const {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl,
} = require('insomnia-url');
const { jarFromCookies } = require('insomnia-cookies');

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
            displayName: 'OAuth 2.0 Token',
            value: 'oauth2',
            description: 'access token',
          },
        ],
      },
      {
        type: 'string',
        hide: args => ['url', 'oauth2', 'name', 'folder'].includes(args[0].value),
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
            throw new Error(`No query parameters available`);
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
            throw new Error(`No headers available`);
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
          const token = await context.util.models.oAuth2Token.getByRequestId(request._id);
          if (!token) {
            throw new Error('No OAuth 2.0 tokens found for request');
          }
          return token.accessToken;
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
