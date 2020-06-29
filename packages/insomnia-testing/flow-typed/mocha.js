// @flow

declare class Mocha {
  constructor(options?: { global?: Array<string> }): Mocha;
  static Runner: {
    constants: Object;
  };
  static reporters: {
    Base: Object;
    JSON: Object;
  };
  files: Array<string>,
  reporter(reporter: Object, options: Object): void;
  addFile(filename: string): void;
  run(callback: (failures: number) => void): Object;
}

declare module 'mocha' {
  declare module.exports: typeof Mocha;
}
