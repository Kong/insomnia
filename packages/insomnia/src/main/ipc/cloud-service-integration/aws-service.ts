import { DecryptionFailure, GetSecretValueCommand, type GetSecretValueCommandOutput, InternalServiceError, InvalidParameterException, InvalidRequestException, ResourceNotFoundException, SecretsManagerClient, SecretsManagerServiceException } from '@aws-sdk/client-secrets-manager';
import { GetCallerIdentityCommand, type GetCallerIdentityCommandOutput, STSClient, STSServiceException } from '@aws-sdk/client-sts';
import crypto from 'crypto';

import type { AWSTemporaryCredential, CloudProviderName } from '../../../models/cloud-credential';
import type { AWSSecretConfig, CloudServiceResult, ICloudService } from './types';

export type AWSGetSecretConfig = Omit<AWSSecretConfig, 'SecretId' | 'SecretType' | 'SecretKey'>;
export const providerName: CloudProviderName = 'aws';
export class AWSService implements ICloudService {
  _credential: AWSTemporaryCredential;

  constructor(credential: AWSTemporaryCredential) {
    this._credential = credential;
  }

  async authorize(): Promise<CloudServiceResult<GetCallerIdentityCommandOutput>> {
    const { region, accessKeyId, secretAccessKey, sessionToken } = this._credential;
    const stsClient = new STSClient({
      region,
      credentials: {
        accessKeyId, secretAccessKey, sessionToken,
      },
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
    const {
      VersionId = '',
      VersionStage = '',
    } = config || {};
    const uniqueKey = `${providerName}:${secretName}:${VersionId}:${VersionStage}`;
    const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
    return uniqueKeyHash;
  }

  async getSecret(secretNameOrARN: string, config?: AWSGetSecretConfig): Promise<CloudServiceResult<GetSecretValueCommandOutput>> {
    const { region, accessKeyId, secretAccessKey, sessionToken } = this._credential;
    const { VersionId, VersionStage } = config || {};
    const secretClient = new SecretsManagerClient({
      region,
      credentials: {
        accessKeyId, secretAccessKey, sessionToken,
      },
    });
    try {
      const input = {
        SecretId: secretNameOrARN,
        ...(VersionId && { VersionId }),
        ...(VersionStage && { VersionStage }),
      };
      const response = await secretClient.send(
        new GetSecretValueCommand(input)
      );
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
        };
      };
      return {
        success: false,
        result: null,
        error: { errorCode, errorMessage },
      };
    }
  }
};
