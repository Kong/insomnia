// @flow

declare module 'graphql' {
  declare type Tok = {
    column: number,
    end: number,
    kind: string,
    line: number,
    next: Tok,
    prev: Tok,
    start: number
  };

  declare type Loc = {
    end: number,
    endToken: Tok,
    source: Source,
    start: number,
    startToken: Tok
  };

  declare type ParseOptions = mixed;
  declare type Source = mixed;
  declare type Document = {
    definitions: Array<{
      kind: string,
      loc: Loc,
      variableDefinitions: Array<{
        variable: {
          name: {
            kind: string,
            value: string
          }
        },
        type: string
      }>,
      name: {
        kind: string,
        value: string
      }
    }>
  };

  declare function parse(
    source: Source | string,
    options?: ParseOptions
  ): Document;

  declare module.exports: {
    parse: typeof parse,
    print: *,
    typeFromAST: *
  };
}

declare module 'graphql/utilities/introspectionQuery' {
  declare module.exports: {
    introspectionQuery: string
  };
}

declare module 'graphql/utilities/buildClientSchema' {
  declare module.exports: {
    buildClientSchema: Function
  };
}
