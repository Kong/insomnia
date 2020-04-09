// @flow

declare module '@storybook/addon-knobs' {
  declare module.exports: {
    select: (string, Object) => Object,
    boolean: (string, boolean) => Object,
    text: (label: string, defaultValue: string) => Object,
    withKnobs: Object,
  }
}
