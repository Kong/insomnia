import * as querystring from '../../common/querystring';
import {prepareUrlForSending} from '../../common/misc';
import {jarFromCookies} from '../../common/cookies';

export default {
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
        {displayName: 'Header', value: 'header', description: 'header value by name'}
      ]
    },
    {
      type: 'string',
      hide: args => ['url'].includes(args[0].value),
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
        const cookieJar = await context.util.models.cookieJar.getOrCreateForParentId(workspace._id);
        const url = await getRequestUrl(context, request);
        const value = await getCookieValue(cookieJar, url, name);
        return value;
      case 'header':
        for (const header of request.headers) {
          const currentName = await context.util.render(name);
          if (currentName.toLowerCase() === name.toLowerCase()) {
            return context.util.render(header.value);
          }
        }
        throw new Error(`No header for name "${name}"`);
    }

    return null;
  }
};

async function getRequestUrl (context, request) {
  const url = await context.util.render(request.url);
  const parameters = [];
  for (const p of request.parameters) {
    parameters.push({
      name: await context.util.render(p.name),
      value: await context.util.render(p.value)
    });
  }

  const qs = querystring.buildFromParams(parameters);
  const finalUrl = querystring.joinUrl(url, qs);

  return prepareUrlForSending(finalUrl, request.settingEncodeUrl);
}

function getCookieValue (cookieJar, url, name) {
  return new Promise((resolve, reject) => {
    const jar = jarFromCookies(cookieJar.cookies);

    jar.getCookies(url, {}, (err, cookies) => {
      if (err) {
        console.warn(`Failed to find cookie for ${url}`, err);
      }

      const cookie = cookies.find(cookie => cookie.key === name);
      if (!cookie) {
        const names = cookies.map(c => `"${c.key}"`).join(', ');
        reject(new Error(`No cookie with name "${name}". Choices are ${names} for url "${url}"`));
      } else {
        resolve(cookie ? cookie.value : null);
      }
    });
  });
}
