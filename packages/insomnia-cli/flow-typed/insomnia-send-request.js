// @flow

declare module 'insomnia-send-request' {
  declare module.exports: {
    getSendRequestCallback: (
      environmentId: string,
      memDb: { [string]: Array<Object> },
    ) => Promise<Object>,
  }
}
