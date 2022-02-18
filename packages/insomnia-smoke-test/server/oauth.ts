import { Configuration, Provider } from 'oidc-provider';

export const oauthRoutes = (port: number) => {
  const oidcConfig: Configuration = {
    features: {
      devInteractions: {
        enabled: true,
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
    },
    clients: [
      {
        client_id: 'foo',
        client_secret: 'bar',
        redirect_uris: [`http://localhost:${port}/authorization-code/callback`],
      },
    ],
  };

  const oidc = new Provider(`http://localhost:${port}`, oidcConfig);

  return oidc.callback();
};
