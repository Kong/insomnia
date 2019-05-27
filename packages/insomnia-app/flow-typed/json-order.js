// @flow

declare module 'json-order' {
  declare type OrderedParseResult = {
    object: object,
    map: { [key: string]: Array<string> },
  };

  declare module.exports: {
    orderedJson: {
      parse: (jsonString: string, prefix?: string, separator?: string) => OrderedParseResult,
      stringify: (
        sourceObject: object,
        map: { [key: string]: Array<string> } | null,
        separator?: string,
        space?: number | void,
      ) => string,
    },
  };
}
