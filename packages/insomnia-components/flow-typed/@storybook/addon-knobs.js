// @flow

declare module '@storybook/addon-knobs' {
  declare module.exports: {
    select: (string, Object, ?string) => Object,
    boolean: (string, boolean) => Object,
    text: (label: string, defaultValue: string) => Object,
    withKnobs: Object,
  }
}
