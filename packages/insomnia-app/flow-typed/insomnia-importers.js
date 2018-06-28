// @flow

declare module 'insomnia-importers' {
  declare module.exports: {
    convert: (
      data: string
    ) => Promise<{
      type: {
        id: string,
        name: string,
        description: string
      },
      data: {
        resources: Array<Object>
      }
    }>
  };
}
