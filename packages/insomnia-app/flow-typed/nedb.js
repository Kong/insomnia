// @flow

declare class NeDB {
  constructor(config: Object): NeDB;
  persistence: {
    setAutocompactionInterval: (millis: number) => void
  };
}

declare module 'nedb' {
  declare module.exports: typeof NeDB;
}
