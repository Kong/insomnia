import { GetCallerIdentityCommand, type GetCallerIdentityCommandOutput, STSClient, STSServiceException } from '@aws-sdk/client-sts';

import type { AWSTemporaryCredential, CloudProviderName } from '../../../models/cloud-credential';
import type { AWSSecretConfig, CloudServiceResult, ICloudService } from './types';

export type AWSGetSecretConfig = Omit<AWSSecretConfig, 'SecretId' | 'SecretType' | 'SecretKey'>;
export const providerName: CloudProviderName = 'aws';
export class AWSService implements ICloudService {
  _credential: AWSTemporaryCredential;

  constructor(credential: AWSTemporaryCredential) {
    this._credential = credential;
  }

  async authenticate(): Promise<CloudServiceResult<GetCallerIdentityCommandOutput>> {
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
};
