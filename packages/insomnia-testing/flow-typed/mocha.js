// @flow

declare class Mocha {
  constructor(options?: { global?: Array<string>, bail?: boolean }): Mocha;
  static Runner: {
    constants: Object;
  };
  static reporters: {
    Base: Object;
    JSON: Object;
    Spec: Object;
    List: Object;
    Dot: Object;
    Min: Object;
    Progress: Object;
  };
  files: Array<string>,
  reporter(reporter: Object, options: Object): void;
  addFile(filename: string): void;
  run(callback: (failures: number) => void): Object;
}

declare module 'mocha' {
  declare module.exports: typeof Mocha;
}
