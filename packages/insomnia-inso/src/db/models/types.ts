// Simplified and extracted from insomnia/src/models/*
import { Database } from '../index';

export interface BaseModel {
    _id: string;
    name: string;
    type: keyof Database;
    parentId: string;
}

export interface BaseApiSpec {
    fileName: string;
    contentType: 'json' | 'yaml';
    contents: string;
}

export type ApiSpec = BaseModel & BaseApiSpec;

interface BaseUnitTestSuite {
    name: string;
    metaSortKey: number;
}

export type UnitTestSuite = BaseModel & BaseUnitTestSuite;

interface BaseUnitTest {
    name: string;
    code: string;
    requestId: string | null;
    metaSortKey: number;
}

export type UnitTest = BaseModel & BaseUnitTest;

interface BaseEnvironment {
    name: string;
    metaSortKey: number;
}

export type Environment = BaseModel & BaseEnvironment;

interface BaseWorkspace {
    name: string;
    description: string;
}

export type Workspace = BaseModel & BaseWorkspace;

export type InsomniaRequest = BaseModel & {
    name: string;
    description: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    metaSortKey: number;
};
