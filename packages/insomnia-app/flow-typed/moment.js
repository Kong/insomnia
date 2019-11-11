// @flow

declare type moment = {
  fromNow: () => string,
  format: (fmt: string) => string,
  diff: (date: any, fmt?: string, floating?: boolean) => number,
  isSame: (date?: any, units?: ?string) => boolean,
};

declare module 'moment' {
  declare module.exports: (date?: any) => moment;
}
