// @flow

// Simplified and extracted from insomnia-app/app/models/*

export type BaseModel = {
  _id: string,
  type: string,
  parentId: string,
};

type BaseApiSpec = {
  fileName: string,
  contentType: 'json' | 'yaml',
  contents: string,
};

export type ApiSpec = BaseModel & BaseApiSpec;

type BaseUnitTestSuite = {
  name: string,
};

export type UnitTestSuite = BaseModel & BaseUnitTestSuite;

type BaseUnitTest = {
  name: string,
  code: string,
  requestId: string | null,
};

export type UnitTest = BaseModel & BaseUnitTest;

type BaseEnvironment = {
  name: string,
  metaSortKey: number,
};

export type Environment = BaseModel & BaseEnvironment;

type BaseWorkspace = {
  name: string,
  description: string,
};

export type Workspace = BaseModel & BaseWorkspace;
