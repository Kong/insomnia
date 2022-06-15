import express, { urlencoded } from 'express';
import { Configuration, Provider } from 'oidc-provider';
// @ts-expect-error no typings available for this module
import { InvalidGrant } from 'oidc-provider/lib/helpers/errors';

export const oauthRoutes = (port: number) => {
  const clientIDAuthorizationCode = 'authorization_code';
  const clientIDAuthorizationCodePKCE = 'authorization_code_pkce';
  const clientIDImplicit = 'implicit';
  const clientIDClientCreds = 'client_credentials';
  const clientIDResourceOwner = 'resource_owner';

  const clientSecret = 'secret';

  const clientRedirectUri = `http://127.0.0.1:${port}/callback`;

  /* eslint-disable camelcase */
  const oidcConfig: Configuration = {
    interactions: {
      url: (_, interaction) => {
        return `/oidc/interaction/${interaction.uid}`;
      },
    },
    cookies: {
      long: {
        httpOnly: false,
      },
      short: {
        httpOnly: false,
      },
    },
    features: {
      devInteractions: {
        enabled: false,
      },
      registration: {
        enabled: false,
      },
      revocation: {
        enabled: true,
      },
      userinfo: {
        enabled: true,
      },
      clientCredentials: {
        enabled: true,
      },
    },
    clients: [
      {
        client_id: clientIDAuthorizationCode,
        client_secret: clientSecret,
        redirect_uris: [clientRedirectUri],
        grant_types: ['authorization_code'],
      },
      {
        client_id: clientIDAuthorizationCodePKCE,
        client_secret: clientSecret,
        redirect_uris: [clientRedirectUri],
        grant_types: ['authorization_code'],
      },
      {
        client_id: clientIDImplicit,
        client_secret: clientSecret,
        redirect_uris: [clientRedirectUri],

        token_endpoint_auth_method: 'none',
        grant_types: ['implicit'],
        response_types: ['id_token', 'id_token token'],
      },
      {
        client_id: clientIDClientCreds,
        client_secret: clientSecret,
        redirect_uris: [clientRedirectUri],
        grant_types: ['authorization_code', 'client_credentials'],
      },
      {
        client_id: clientIDResourceOwner,
        client_secret: clientSecret,
        redirect_uris: [clientRedirectUri],
        grant_types: ['authorization_code', 'password'],
      },
    ],
    pkce: {
      methods: [
        'S256',
        'plain',
      ],
      required: (_, client) => {
        // Require PKCE for the PKCE client id
        return client.clientId === clientIDAuthorizationCodePKCE;
      },
    },
    responseTypes: [
      'code',
      'id_token', 'id_token token',
      'none',
    ],
    issueRefreshToken: () => {
      return false;
    },
    // https://github.com/panva/node-oidc-provider/blob/main/recipes/skip_consent.md
    loadExistingGrant: async ctx => {
      const grantId = (ctx.oidc.result?.consent?.grantId) || (ctx.oidc.session!.grantIdFor(ctx.oidc.client!.clientId));

      if (grantId) {
        const grant = await ctx.oidc.provider.Grant.find(grantId);
        if (grant) {
          if (ctx.oidc.account && grant.exp! < ctx.session?.exp) {
            grant.exp = ctx.session?.exp;
            await grant!.save();
          }

          return grant;
        }
      }

      const grant = new ctx.oidc.provider.Grant({
        clientId: ctx.oidc.client!.clientId,
        accountId: ctx.oidc.session!.accountId,
      });

      grant.addOIDCScope('openid email profile');

      await grant.save();

      return grant;
    },
  };
  /* eslint-enable camelcase */

  const oidc = new Provider(`http://127.0.0.1:${port}`, oidcConfig);

  allowLocalhostImplicit(oidc);
  registerROPC(oidc);

  const oauthRouter = express.Router();

  // Route for verifying that id tokens are valid for implicit id token only flows
  oauthRouter.get('/id-token', async (req, res) => {
    const client = await oidc.Client.find(clientIDImplicit);
    if (!client) {
      res
        .status(500)
        .header('Content-Type', 'text/plain')
        .send('Client not found');
      return;
    }

    const authorizationHeader = req.header('Authorization');
    if (!authorizationHeader) {
      res
        .status(400)
        .header('Content-Type', 'text/plain')
        .send('Missing Authorization header');
      return;
    }

    try {
      const validated = await oidc.IdToken.validate(extractToken(authorizationHeader), client);
      res
        .status(200)
        .json(validated);
    } catch (err) {
      res
        .status(500)
        .header('Content-Type', 'text/plain')
        .send('Invalid authorization header');
    }
  });

  // Route for verifying that client credentials are valid
  oauthRouter.get('/client-credential', async (req, res) => {
    const authorizationHeader = req.header('Authorization');
    if (!authorizationHeader) {
      res
        .status(400)
        .header('Content-Type', 'text/plain')
        .send('Missing Authorization header');
      return;
    }

    const clientCredentials = await oidc.ClientCredentials.find(extractToken(authorizationHeader));
    if (!clientCredentials) {
      res
        .status(400)
        .header('Content-Type', 'text/plain')
        .send('Invalid client credentials');
      return;
    }

    res
      .status(200)
      .json(clientCredentials);
  });

  oauthRouter.get('/interaction/:uid', async (req, res, next) => {
    try {
      const {
        uid, prompt,
      } = await oidc.interactionDetails(req, res);

      switch (prompt.name) {
        case 'login': {
          return res.send(`
            <html>
            <body>
              <form autocomplete="off" action="/oidc/interaction/${uid}/login" method="post">
                <input required type="text" name="login" placeholder="Enter any login" autofocus="on">
                <input required type="password" name="password" placeholder="and password">

                <button type="submit">Sign-in</button>
              </form>
            </body>
            </html>
          `);
        }
        default:
          return next(new Error('Invalid prompt'));
      }
    } catch (err) {
      return next(err);
    }
  });

  const body = urlencoded({ extended: false });

  oauthRouter.post('/interaction/:uid/login', body, async (req, res, next) => {
    try {
      await oidc.interactionDetails(req, res);

      const account = await (oidc.Account as any).findAccount(
        null,
        req.body.login,
      );

      const result = {
        login: {
          accountId: account!.accountId,
        },
      };

      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  oauthRouter.use(oidc.callback());

  return oauthRouter;
};

// Allow implicit to function despite the redirect address being http and localhost
// https://github.com/panva/node-oidc-provider/blob/main/recipes/implicit_http_localhost.md
function allowLocalhostImplicit(oidc: Provider) {
  const { invalidate: orig } = (oidc.Client as any).Schema.prototype;

  (oidc.Client as any).Schema.prototype.invalidate = function invalidate(message: any, code: any) {
    if (code === 'implicit-force-https' || code === 'implicit-forbid-localhost') {
      return;
    }

    orig.call(this, message);
  };
}

// Custom grant type to support ROPC, as oidc-provider does not natively support it
// https://github.com/panva/node-oidc-provider/tree/main/docs#password-grant-type-ropc
const parameters = ['username', 'password', 'scope'];
function registerROPC(oidc: Provider) {
  oidc.registerGrantType('password', async (ctx, next) => {
    const params = ctx.oidc.params;

    if (!params) {
      throw new InvalidGrant('invalid params provided');
    }

    if (!ctx.oidc.client) {
      throw new InvalidGrant('invalid client provided');
    }

    if (typeof params.username !== 'string' || typeof params.password !== 'string') {
      throw new InvalidGrant('invalid credentials provided');
    }

    const account = await ctx.oidc.provider.Account.findAccount(
      ctx,
      params.username
    );
    if (!account) {
      throw new InvalidGrant('invalid account');
    }

    const grant = new ctx.oidc.provider.Grant({
      clientId: ctx.oidc.client.clientId,
      accountId: account.accountId,
    });
    await grant.save();

    const { AccessToken } = ctx.oidc.provider;
    const at = new AccessToken({
      accountId: account.accountId,
      client: ctx.oidc.client,
      grantId: grant.jti,
      gty: 'password',
      scope: typeof params.scope === 'string' ? params.scope : '',
      claims: {
        userinfo: {
          sub: {
            value: account.accountId,
          },
        },
      },
    });

    const accessToken = await at.save();

    /* eslint-disable camelcase */
    ctx.body = {
      access_token: accessToken,
      expires_in: at.expiration,
      scope: at.scope,
      token_type: at.tokenType,
    };
    /* eslint-enable camelcase */

    await next();
  }, parameters);
}

function extractToken(authorizationHeader: string) {
  const split = authorizationHeader.split(' ');
  if (split.length === 2 && split[0] === 'Bearer') {
    return split[1];
  }

  return '';
}
