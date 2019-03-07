// @flow

declare class Binary {
  constructor(input: string): Binary;
}

declare module 'bson' {
  declare module.exports: {
    Binary: typeof Binary,
    serialize: (obj: Object) => Buffer,
    deserialize: (buff: Buffer) => Object,
  };
}
