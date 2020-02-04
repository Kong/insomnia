// @flow

declare class Color {
  constructor(cssColor: string): Color;
  rgb: () => Object;
}

declare module 'color' {
  declare module.exports: typeof NeDB;
}
