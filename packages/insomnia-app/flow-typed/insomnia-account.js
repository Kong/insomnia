// @flow

declare module 'insomnia-account' {
  declare module.exports: {
    session: {
      login: (email: string, password: string) => Promise<void>,
      getPublicKey: () => Object,
      getPrivateKey: () => Object,
      getCurrentSessionId: () => string,
      getAccountId: () => string,
      getEmail: () => string,
      getFirstName: () => string,
      logout: () => Promise<void>,
      endTrial: () => Promise<void>,
      isLoggedIn: () => boolean,
    },
    fetch: {
      get: (path: string, sessionId: string) => Promise<Object>,
      put: (path: string, body: Object, sessionId: string) => Promise<Object>,
      post: (path: string, body: Object, sessionId: string) => Promise<Object>,
    },
    crypt: {
      generateAES256Key: () => Object,
      encryptRSAWithJWK: (key: Object, plaintext: string) => string,
    },
  };
}
