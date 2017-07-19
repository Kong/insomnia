declare module 'insomnia-importers' {
  declare module.exports: {
    convert: (data: string) => {
      data: {
        resources: Array<Object>
      }
    }
  }
}
