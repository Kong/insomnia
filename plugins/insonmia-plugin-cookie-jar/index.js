module.exports.templateTags = [
  {
    name: 'cookieJar',
    displayName: 'Cookie Jar',
    description: 'reference a cookie value from the cookie jar',
    args: [
      {
        type: 'string',
        displayName: "Cookie Domain"
      },
      {
        type: 'string',
        displayName: "Cookie Key"
      }
    ],
    async run(context, cookieDomain, cookieName) {
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

      const cookies = cookieJar.cookies;

      // Validate cookie domain
      let cookiesWithMatchedDomain = cookies.filter(cookie => cookie.domain === cookieDomain);

      if(cookiesWithMatchedDomain.length === 0) {
        const uniqueCookieDomains = unique(cookies.map(n => `"${n.domain}"`)).join(',\n\t');

        throw new Error(
          `No cookie domain with name "${cookieDomain}".\nChoices are [\n\t${uniqueCookieDomains}\n]`
        );
      }

      // Validate cookie name on specific domain
      cookie = cookiesWithMatchedDomain.find(cookie => cookie.key === cookieName);
      if(!cookie) {
        const uniqueCookieNames = unique(cookiesWithMatchedDomain.map(n => `"${n.key}"`)).join(',\n\t');

        throw new Error(
          `No cookie key with name "${cookieName}" on domain "${cookieDomain}".\nChoices are [\n\t${uniqueCookieNames}\n]`
        );
      }

      return cookie.value;
    }
  }
];

function unique(input) {
  return uniqueValues = [...new Set(input)];
}
