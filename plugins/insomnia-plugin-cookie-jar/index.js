const { jarFromCookies } = require('insomnia-cookies');

module.exports.templateTags = [
  {
    name: 'cookie',
    displayName: 'Cookie',
    description: 'reference a cookie value from the cookie jar',
    args: [
      {
        type: 'string',
        displayName: 'Cookie Url',
        description: 'fully qualified URL (e.g. https://domain.tld/path)'
      },
      {
        type: 'string',
        displayName: 'Cookie Name'
      }
    ],
    async run(context, url, name) {
      const { meta } = context;

      if (!meta.requestId || !meta.workspaceId) {
        return null;
      }

      const workspace = await context.util.models.workspace.getById(
        meta.workspaceId
      );

      if (!workspace) {
        throw new Error(`Workspace not found for ${meta.workspaceId}`);
      }

      const cookieJar = await context.util.models.cookieJar.getOrCreateForWorkspace(
        workspace
      );

      return getCookieValue(cookieJar, url, name);
    }
  }
];

function getCookieValue(cookieJar, url, name) {
  return new Promise((resolve, reject) => {
    const jar = jarFromCookies(cookieJar.cookies);

    jar.getCookies(url, {}, (err, cookies) => {
      if (err) {
        console.warn(`Failed to find cookie for ${url}`, err);
      }

      if (!cookies || cookies.length === 0) {
        console.log(cookies);
        reject(new Error(`No cookies in store for url "${url}"`));
      }

      const cookie = cookies.find(cookie => cookie.key === name);
      if (!cookie) {
        const names = cookies.map(c => `"${c.key}"`).join(',\n\t');
        throw new Error(
          `No cookie with name "${name}".\nChoices are [\n\t${names}\n] for url "${url}"`
        );
      } else {
        resolve(cookie ? cookie.value : null);
      }
    });
  });
}
