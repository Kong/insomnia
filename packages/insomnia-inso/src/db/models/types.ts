// Simplified and extracted from insomnia-app/app/models/*
import { Database } from '../index';

export interface BaseModel {
    _id: string;
    type: keyof Database;
    parentId: string;
}

interface BaseApiSpec {
    fileName: string;
    contentType: 'json' | 'yaml';
    contents: string;
}

export type ApiSpec = BaseModel & BaseApiSpec;

interface BaseUnitTestSuite {
    name: string;
}

export type UnitTestSuite = BaseModel & BaseUnitTestSuite;

interface BaseUnitTest {
    name: string;
    code: string;
    requestId: string | null;
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
