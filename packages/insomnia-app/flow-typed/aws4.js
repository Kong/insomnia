// @flow

declare module 'aws4' {
  declare module.exports: {
    sign: (
      options: Object,
      credentials: Object
    ) => { headers: { [string]: string } }
  };
}
