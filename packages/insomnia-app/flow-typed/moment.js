// @flow

declare type moment = {
  fromNow: () => string,
  format: (fmt: string) => string
};

declare module 'moment' {
  declare module.exports: (date?: any) => moment;
}
