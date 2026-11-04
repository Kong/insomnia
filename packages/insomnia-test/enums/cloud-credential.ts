export enum AWSCredentialType {
  temp = "temporary",
  file = "file",
  sso = "sso",
}

export enum HashiCorpCredentialType {
  cloudVaultSecrets = "cloud",
  cloudVaultDedicated = "cloudVaultDedicated",
  onPrem = "onPrem",
}

export enum HashiCorpVaultAuthMethod {
  token = "token",
  appRole = "appRole",
}
