declare module '@storybook/addon-knobs' {
  declare module.exports: {
    select: (string, Object) => Object,
    boolean: (string, boolean) => Object,
    withKnobs: Object,
  }
}
