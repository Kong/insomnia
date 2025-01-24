import type { AWSTemporaryCredential, BaseCloudCredential, CloudProviderName } from '../../../models/cloud-credential';
import { ipcMainHandle } from '../electron';
import { type AWSGetSecretConfig, AWSService } from './aws-service';

export interface cloudServiceBridgeAPI {
  authenticate: typeof cspAuthentication;
}
export interface CloudServiceAuthOption {
  provider: CloudProviderName;
  credentials: BaseCloudCredential['credentials'];
}
export interface CloudServiceSecretOption<T extends {}> extends CloudServiceAuthOption {
  secretId: string;
  config: T;
}
export type CloudServiceGetSecretConfig = AWSGetSecretConfig;

export function registerCloudServiceHandlers() {
  ipcMainHandle('cloudService.authenticate', (_event, options) => cspAuthentication(options));
}

// factory pattern to create cloud service class based on its provider name
class ServiceFactory {
  static createCloudService(name: CloudProviderName, credential: BaseCloudCredential['credentials']) {
    switch (name) {
      case 'aws':
        return new AWSService(credential as AWSTemporaryCredential);
      default:
        throw new Error('Invalid cloud service provider name');
    }
  }
};

// authenticate with cloud service provider
const cspAuthentication = (options: CloudServiceAuthOption) => {
  const { provider, credentials } = options;
  const cloudService = ServiceFactory.createCloudService(provider, credentials);
  return cloudService.authenticate();
};
