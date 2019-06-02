// @flow

declare module 'json-order' {
  declare type OrderedParseResult = {
    object: Object,
    map: { [key: string]: Array<string> },
  };

  declare type orderedJSON = {
    parse: (jsonString: string, prefix?: string, separator?: string) => OrderedParseResult,
    stringify: (
      sourceObject: Object,
      map: { [key: string]: Array<string> } | null,
      separator?: string,
      space?: number | void,
    ) => string,
  };

  declare module.exports: orderedJSON;
}
