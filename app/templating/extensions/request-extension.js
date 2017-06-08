import * as models from '../../models/index';
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

    const request = await models.request.getById(meta.requestId);
    const workspace = await models.workspace.getById(meta.workspaceId);

    if (!request) {
      throw new Error(`Request not found for ${meta.requestId}`);
    }

    if (!workspace) {
      throw new Error(`Workspace not found for ${meta.workspaceId}`);
    }

    switch (attribute) {
      case 'url':
        return getRequestUrl(request);
      case 'cookie':
        const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);
        const url = getRequestUrl(request);
        const value = await getCookieValue(cookieJar, url, name);
        return value;
      case 'header':
        const header = request.headers.find(header => (
          header.name.toLowerCase() === name.toLowerCase()
        ));
        return header ? header.value : null;
    }

    return null;
  }
};

function getRequestUrl (request) {
  const qs = querystring.buildFromParams(request.parameters);
  const url = querystring.joinUrl(request.url, qs);
  return prepareUrlForSending(url, request.settingEncodeUrl);
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
        reject(new Error(`No cookie found with name "${name}"`));
      } else {
        resolve(cookie ? cookie.value : null);
      }
    });
  });
}
