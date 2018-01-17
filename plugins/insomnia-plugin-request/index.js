const {buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl} = require('insomnia-url');
const {jarFromCookies} = require('insomnia-cookies');

module.exports.templateTags = [{
  name: 'request',
  displayName: 'Request',
  description: 'reference value from current request',
  args: [
    {
      displayName: 'Attribute',
      type: 'enum',
      options: [
        {displayName: 'URL', value: 'url', description: 'fully qualified URL'},
        {displayName: 'Cookie', value: 'cookie', description: 'cookie value by name'},
        {displayName: 'Header', value: 'header', description: 'header value by name'},
        {displayName: 'OAuth 2.0 Token', value: 'oauth2', description: 'access token'}
      ]
    },
    {
      type: 'string',
      hide: args => ['url', 'oauth2'].includes(args[0].value),
      displayName: args => {
        switch (args[0].value) {
          case 'cookie':
            return 'Cookie Name';
          case 'header':
            return 'Header Name';
          default:
            return 'Name';
        }
      }
    }
  ],

  async run (context, attribute, name) {
    const {meta} = context;

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
      case 'header':
        if (!name) {
          throw new Error('No header specified');
        }

        const names = [];

        if (request.headers.length === 0) {
          throw new Error(`No headers available`);
        }

        for (const header of request.headers) {
          const headerName = await context.util.render(header.name);
          names.push(headerName);
          if (headerName.toLowerCase() === name.toLowerCase()) {
            return context.util.render(header.value);
          }
        }

        const namesStr = names.map(n => `"${n}"`).join(',\n\t');
        throw new Error(`No header with name "${name}".\nChoices are [\n\t${namesStr}\n]`);
      case 'oauth2':
        const token = await context.util.models.oAuth2Token.getByRequestId(request._id);
        if (!token) {
          throw new Error('No OAuth 2.0 tokens found for request');
        }
        return token.accessToken;
    }

    return null;
  }
}];

async function getRequestUrl (context, request) {
  const url = await context.util.render(request.url);
  const parameters = [];
  for (const p of request.parameters) {
    parameters.push({
      name: await context.util.render(p.name),
      value: await context.util.render(p.value)
    });
  }

  const qs = buildQueryStringFromParams(parameters);
  const finalUrl = joinUrlAndQueryString(url, qs);

  return smartEncodeUrl(finalUrl, request.settingEncodeUrl);
}

function getCookieValue (cookieJar, url, name) {
  return new Promise((resolve, reject) => {
    const jar = jarFromCookies(cookieJar.cookies);

    jar.getCookies(url, {}, (err, cookies) => {
      if (err) {
        console.warn(`Failed to find cookie for ${url}`, err);
      }

      if (!cookies || cookies.length === 0) {
        reject(new Error(`No cookies in stored for url "${url}"`));
      }

      const cookie = cookies.find(cookie => cookie.key === name);
      if (!cookie) {
        const names = cookies.map(c => `"${c.key}"`).join(',\n\t');
        throw new Error(`No cookie with name "${name}".\nChoices are [\n\t${names}\n] for url "${url}"`);
      } else {
        resolve(cookie ? cookie.value : null);
      }
    });
  });
}
