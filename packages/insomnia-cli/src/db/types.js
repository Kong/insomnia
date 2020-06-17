// @flow

export type ModelEnum = 'ApiSpec' | 'Workspace' | 'Request' | 'RequestGroup' | 'Environment';

// These types should come from a shared location (maybe insomnia-importers?)
// They represent the models that are read from an Insomnia data source
// eg. git data directory, insomnia export format, etc

export type BaseModel = {
  _id: string,
  type: string,
  parentId: string,
  modified: number,
  created: number,
};

type BaseApiSpec = {
  fileName: string,
  contentType: 'json' | 'yaml',
  contents: string,
};

export type ApiSpec = BaseModel & BaseApiSpec;
