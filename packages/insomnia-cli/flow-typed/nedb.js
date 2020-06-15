// @flow

declare class NeDB {
  constructor(config?: Object): NeDB;
}

declare module 'nedb' {
  declare module.exports: typeof NeDB;
}
