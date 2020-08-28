// @flow

declare module 'insomnia-send-request' {
  declare module.exports: {
    getSendRequestCallback: ( environmentId: string ) => Promise<Object>,
    getSendRequestCallbackMemDb: (
      environmentId: string,
      memDb: { [string]: Array<Object> },
    ) => Promise<Object>,
  }
}
