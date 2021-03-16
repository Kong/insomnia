// @flow

declare class Color {
  constructor(cssColor: string): Color;
  rgb(): Object;
}

declare module 'color' {
  declare module.exports: (cssColor: string) => {
    rgb: () => {
      array: () => Array<number>,
      string: () => string,
    },
  }
}
