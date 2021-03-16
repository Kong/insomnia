// @flow

declare module 'openapi-2-kong' {
  declare module.exports: {
    generateFromString: (spec: string, tags: Array<string>) => Promise<Object>,
    generateFromSpec: (spec: Object, tags: Array<string>) => Promise<Object>,
    generate: (filename: string, tags: Array<string>) => Promise<Object>,
  };
}
