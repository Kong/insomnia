import {
  DecryptionFailure,
  GetSecretValueCommand,
  type GetSecretValueCommandOutput,
  InternalServiceError,
  InvalidParameterException,
  InvalidRequestException,
  ResourceNotFoundException,
  SecretsManagerClient,
  SecretsManagerServiceException,
} from '@aws-sdk/client-secrets-manager';
import {
  GetCallerIdentityCommand,
  type GetCallerIdentityCommandOutput,
  STSClient,
  STSServiceException,
} from '@aws-sdk/client-sts';
import { fromIni, fromSSO } from '@aws-sdk/credential-providers';
import crypto from 'crypto';

import { AWSCredentialType, type AWSServiceCredential, type CloudProviderName } from '../../../models/cloud-credential';
import type { AWSSecretConfig, CloudServiceResult, ICloudService } from './types';

export type AWSGetSecretConfig = Omit<AWSSecretConfig, 'SecretId' | 'SecretType' | 'SecretKey'>;
export const providerName: CloudProviderName = 'aws';
export class AWSService implements ICloudService {
  private _credential: AWSServiceCredential;

  constructor(credential: AWSServiceCredential) {
    this._credential = credential;
  }

  _getAWSCredentials(enableCache: boolean) {
    const { type } = this._credential;

    switch (type) {
      case AWSCredentialType.temp:
        return {
          accessKeyId: this._credential.accessKeyId,
          secretAccessKey: this._credential.secretAccessKey,
          sessionToken: this._credential.sessionToken,
        };

      case AWSCredentialType.file: {
        return fromIni({
          profile: this._credential.section,
          ...(this._credential.filePath && { filepath: this._credential.filePath }),
          ignoreCache: !enableCache,
        });
      }

      case AWSCredentialType.sso: {
        return fromSSO({
          profile: this._credential.section,
          ...(this._credential.filePath && { filepath: this._credential.filePath }),
          ...(this._credential.configFilePath && { configFilePath: this._credential.configFilePath }),
          ignoreCache: !enableCache,
        });
      }

      default:
        throw new Error(`Unsupported credential type: ${type}`);
    }
  }

  async authenticate(): Promise<CloudServiceResult<GetCallerIdentityCommandOutput>> {
    const { region } = this._credential;
    const stsClient = new STSClient({
      region,
      credentials: this._getAWSCredentials(false),
    });

    try {
      const response = await stsClient.send(new GetCallerIdentityCommand({}));
      return {
        success: true,
        result: response,
      };
    } catch (error) {
      const errorDetail = {
        errorCode: error.code || 'UnknownError',
        errorMessage: error.message || 'Failed to authenticate with AWS. An unknown error occurred',
      };
      if (error instanceof STSServiceException) {
        errorDetail.errorCode = error.name || errorDetail.errorCode;
        errorDetail.errorMessage = error.message || errorDetail.errorMessage;
      }
      return {
        success: false,
        result: null,
        error: errorDetail,
      };
    }
  }

  getUniqueCacheKey(secretName: string, config?: AWSGetSecretConfig) {
    const { VersionId = '', VersionStage = '' } = config || {};
    const uniqueKey = `${providerName}:${secretName}:${VersionId}:${VersionStage}`;
    const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
    return uniqueKeyHash;
  }

  async getSecret(
    secretNameOrARN: string,
    config: AWSGetSecretConfig = {},
  ): Promise<CloudServiceResult<GetSecretValueCommandOutput>> {
    const { region } = this._credential;
    const { VersionId, VersionStage } = config;
    const enableCache = 'enableCache' in this._credential ? Boolean(this._credential.enableCache) : false;
    const secretClient = new SecretsManagerClient({
      region,
      credentials: this._getAWSCredentials(enableCache),
    });
    try {
      const input = {
        SecretId: secretNameOrARN,
        ...(VersionId && { VersionId }),
        ...(VersionStage && { VersionStage }),
      };
      const response = await secretClient.send(new GetSecretValueCommand(input));
      return {
        success: true,
        result: response,
      };
    } catch (error) {
      let errorCode = error.code || 'UnknownError';
      let errorMessage = error.message || 'Failed to get Secret. An unknown error occurred';
      if (error instanceof SecretsManagerServiceException) {
        errorMessage = errorMessage || error.message;
        errorCode = errorCode || error.name;
        if (error instanceof DecryptionFailure) {
          errorMessage = "Secrets Manager can't decrypt the protected secret text using the provided KMS key.";
        } else if (error instanceof InternalServiceError) {
          errorMessage = 'An error occurred on the server side.';
        } else if (error instanceof InvalidParameterException) {
          errorMessage = 'The parameter name or value is invalid.';
        } else if (error instanceof InvalidRequestException) {
          errorMessage = 'The request is invalid for the current state of the resource.';
        } else if (error instanceof ResourceNotFoundException) {
          errorMessage = "Secrets Manager can't find the specified resource.";
        }
      }
      return {
        success: false,
        result: null,
        error: { errorCode, errorMessage },
      };
    }
  }
}
