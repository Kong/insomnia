declare module 'graphql' {
  declare module.exports: *;
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
