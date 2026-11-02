import { describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';

import { allTypesSchema } from './base-types';
import * as dbModels from './db-models';
import { getEncryptedFieldPathsByType, getEncryptedFieldPathsForType } from './encrypted-field-paths';

describe('getEncryptedFieldPathsByType()', () => {
  // Any change to the set of encrypted fields shows up here and has to be reviewed
  it('matches the snapshot', () => {
    expect(getEncryptedFieldPathsByType()).toMatchInlineSnapshot(`
      {
        "ApiSpec": [],
        "CaCertificate": [],
        "ClientCertificate": [
          "cert",
          "key",
          "passphrase",
          "pfx",
        ],
        "CloudCredential": [
          "credentials.accessKeyId",
          "credentials.accessToken",
          "credentials.access_token",
          "credentials.client_secret",
          "credentials.secretAccessKey",
          "credentials.secret_id",
          "credentials.sessionToken",
        ],
        "CookieJar": [
          "cookies[].value",
        ],
        "Environment": [],
        "GitCredentials": [
          "credentials.password",
          "credentials.refreshToken",
          "credentials.token",
          "refreshToken",
          "token",
        ],
        "GitRepository": [],
        "GrpcRequest": [
          "reflectionApi.apiKey",
        ],
        "GrpcRequestMeta": [],
        "McpPayload": [],
        "McpRequest": [
          "authentication.accessKeyId",
          "authentication.accessToken",
          "authentication.clientSecret",
          "authentication.consumerSecret",
          "authentication.key",
          "authentication.password",
          "authentication.privateKey",
          "authentication.refreshToken",
          "authentication.secretAccessKey",
          "authentication.sessionToken",
          "authentication.token",
          "authentication.tokenSecret",
          "authentication.value",
        ],
        "McpResponse": [],
        "MockRoute": [],
        "MockServer": [],
        "OAuth2Token": [
          "accessToken",
          "identityToken",
          "refreshToken",
        ],
        "PluginData": [],
        "Project": [],
        "ProjectLintRuleset": [],
        "ProtoDirectory": [],
        "ProtoFile": [],
        "Request": [
          "authentication.accessKeyId",
          "authentication.accessToken",
          "authentication.clientSecret",
          "authentication.consumerSecret",
          "authentication.key",
          "authentication.password",
          "authentication.privateKey",
          "authentication.refreshToken",
          "authentication.secretAccessKey",
          "authentication.sessionToken",
          "authentication.token",
          "authentication.tokenSecret",
          "authentication.value",
        ],
        "RequestGroup": [
          "authentication.accessKeyId",
          "authentication.accessToken",
          "authentication.clientSecret",
          "authentication.consumerSecret",
          "authentication.key",
          "authentication.password",
          "authentication.privateKey",
          "authentication.refreshToken",
          "authentication.secretAccessKey",
          "authentication.sessionToken",
          "authentication.token",
          "authentication.tokenSecret",
          "authentication.value",
        ],
        "RequestGroupMeta": [],
        "RequestMeta": [],
        "RequestVersion": [
          "compressedRequest",
        ],
        "Response": [],
        "RunnerTestResult": [],
        "Settings": [],
        "SocketIOPayload": [],
        "SocketIORequest": [
          "authentication.accessKeyId",
          "authentication.accessToken",
          "authentication.clientSecret",
          "authentication.consumerSecret",
          "authentication.key",
          "authentication.password",
          "authentication.privateKey",
          "authentication.refreshToken",
          "authentication.secretAccessKey",
          "authentication.sessionToken",
          "authentication.token",
          "authentication.tokenSecret",
          "authentication.value",
        ],
        "SocketIORequestMeta": [],
        "SocketIOResponse": [],
        "Stats": [],
        "UnitTest": [],
        "UnitTestResult": [],
        "UnitTestSuite": [],
        "UserSession": [],
        "WebSocketPayload": [],
        "WebSocketRequest": [
          "authentication.accessKeyId",
          "authentication.accessToken",
          "authentication.clientSecret",
          "authentication.consumerSecret",
          "authentication.key",
          "authentication.password",
          "authentication.privateKey",
          "authentication.refreshToken",
          "authentication.secretAccessKey",
          "authentication.sessionToken",
          "authentication.token",
          "authentication.tokenSecret",
          "authentication.value",
        ],
        "WebSocketRequestMeta": [],
        "WebSocketResponse": [],
        "Workspace": [],
        "WorkspaceMeta": [],
      }
    `);
  });

  it('has an entry for every model type and nothing else', () => {
    expect(Object.keys(getEncryptedFieldPathsByType()).sort()).toEqual([...allTypesSchema.options].sort());
  });

  // The path table is keyed by type, so two models with the same type would silently overwrite each other
  it('has exactly one model per type', () => {
    const types = (Object.values(dbModels) as { type: string }[]).map(model => model.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('only lists plain, well-formed paths', () => {
    for (const [type, paths] of Object.entries(getEncryptedFieldPathsByType())) {
      for (const path of paths) {
        expect(path, `${type}: ${path}`).toMatch(/^[A-Za-z_][\w]*(\[\])*(\.[A-Za-z_][\w]*(\[\])*)*$/);
      }
      expect(paths, type).toEqual([...new Set(paths)].sort());
    }
  });

  it('derives from the schema for models on Zod and from encryptedFields for the rest, never both', () => {
    for (const model of Object.values(dbModels) as { type: string; schema?: z.ZodType; encryptedFields?: string[] }[]) {
      expect(model.schema && model.encryptedFields, `${model.type} must not have both`).toBeFalsy();
    }
    expect(getEncryptedFieldPathsByType().ClientCertificate).toEqual(['cert', 'key', 'passphrase', 'pfx']);
  });

  // Guards typos in the temporary `encryptedFields` arrays: the first segment of every path must be a field of the model
  it('uses fields that exist on the model for the models that are not on Zod yet', () => {
    for (const model of [
      dbModels.clientCertificate,
      dbModels.cloudCredential,
      dbModels.gitCredentials,
      dbModels.oAuth2Token,
      dbModels.requestVersion,
    ]) {
      const fields = Object.keys({ ...model.init() });
      for (const path of model.encryptedFields) {
        expect(fields, `${model.type}: ${path}`).toContain(path.split('.')[0]);
      }
    }
  });

  it('is memoized', () => {
    expect(getEncryptedFieldPathsByType()).toBe(getEncryptedFieldPathsByType());
  });
});

describe('getEncryptedFieldPathsForType()', () => {
  it('returns the paths of a type', () => {
    expect(getEncryptedFieldPathsForType('CookieJar')).toEqual(['cookies[].value']);
    expect(getEncryptedFieldPathsForType('GrpcRequest')).toEqual(['reflectionApi.apiKey']);
  });

  it('returns an empty list for types without encrypted fields, unknown types and Object.prototype names', () => {
    expect(getEncryptedFieldPathsForType('Workspace')).toEqual([]);
    expect(getEncryptedFieldPathsForType('NotAType')).toEqual([]);
    expect(getEncryptedFieldPathsForType('toString')).toEqual([]);
    expect(getEncryptedFieldPathsForType('__proto__')).toEqual([]);
  });
});
