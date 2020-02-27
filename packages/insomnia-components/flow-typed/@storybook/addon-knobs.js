declare module '@storybook/addon-knobs' {
  declare module.exports: {
    select: (string, Object) => Object,
    withKnobs: Object,
  }
}
