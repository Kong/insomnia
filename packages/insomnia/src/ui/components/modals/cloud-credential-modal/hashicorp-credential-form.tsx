import React, { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import {
  type CloudProviderCredential,
  type CloudProviderName,
  HashiCorpCredentialType,
  HashiCorpVaultAuthMethod,
  type HCPCredential,
  type VaultAppRoleCredential,
  type VaultTokenCredential,
} from '../../../../models/cloud-credential';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';

type HashiCorpOnPremCredential = VaultAppRoleCredential | VaultTokenCredential;
type HashiCorpCredential = Extract<CloudProviderCredential, { provider: 'hashicorp' }>;
export interface HashiCorpCredentialFormProps {
  data?: HashiCorpCredential;
  onSubmit: (newData: HashiCorpCredential) => void;
  isLoading: boolean;
  errorMessage?: string;
}
const initialFormValue = {
  name: '',
  credentials: {
    type: HashiCorpCredentialType.onPrem,
    authMethod: HashiCorpVaultAuthMethod.appRole,
    serverAddress: '',
  },
};
export const providerType: CloudProviderName = 'hashicorp';

export const HashiCorpCredentialForm = (props: HashiCorpCredentialFormProps) => {
  const { data, onSubmit, isLoading, errorMessage } = props;
  const isEdit = !!data;
  const { name, credentials } = data || initialFormValue;
  const [isValidUrl, setIsValidUrl] = useState(true);
  const { type } = credentials as HashiCorpCredential['credentials'];
  const [credentialType, setCredentialType] = useState<HashiCorpCredentialType>(type);
  const [credentialAuthMethod, setAuthMethod] = useState<HashiCorpVaultAuthMethod>(
    (credentials as VaultTokenCredential | VaultAppRoleCredential).authMethod,
  );
  const [hideValueItemNames, setHideValueItemNames] = useState(['client_secret', 'secret_id', 'access_token']);

  const showOrHideItemValue = (name: string) => {
    if (hideValueItemNames.includes(name)) {
      setHideValueItemNames(hideValueItemNames.filter(n => n !== name));
    } else {
      setHideValueItemNames([...hideValueItemNames, name]);
    }
  };

  const validateServerAddress = (address: string) => {
    let isValid = true;
    try {
      new URL(address);
    } catch (error) {
      isValid = false;
    }
    setIsValidUrl(isValid);
  };

  return (
    <form
      className="flex flex-shrink-0 flex-col gap-2 p-[--padding-sm]"
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(e.currentTarget);
        const {
          name,
          type,
          // cloud system credentials
          client_id,
          client_secret,
          // on-prem system credential
          authMethod,
          serverAddress,
          access_token,
          role_id,
          secret_id,
        } = Object.fromEntries(formData.entries()) as Record<string, string>;
        const commonData = {
          name,
          provider: providerType,
        };
        let newData;
        if (type === HashiCorpCredentialType.cloud) {
          newData = {
            ...commonData,
            credentials: {
              type: type as HashiCorpCredentialType.cloud,
              client_id,
              client_secret,
            },
          };
        } else {
          newData = {
            ...commonData,
            credentials: {
              type: type as HashiCorpCredentialType.onPrem,
              authMethod: authMethod as HashiCorpVaultAuthMethod,
              serverAddress,
              ...(authMethod === HashiCorpVaultAuthMethod.token && { access_token }),
              ...(authMethod === HashiCorpVaultAuthMethod.appRole && { role_id, secret_id }),
            },
          };
        }
        onSubmit(newData as HashiCorpCredential);
      }}
    >
      <TextField className="flex flex-col gap-2" defaultValue={name}>
        <Label className="col-span-4">Credential Name:</Label>
        <Input
          required
          className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          type="text"
          name="name"
          placeholder="Credential name"
        />
      </TextField>
      <div>
        <label>System Type:</label>
        <div className="mt-2 flex flex-row">
          <input
            type="radio"
            id="hashiCorpEnvironmentTypeChoice-onPrem"
            name="type"
            className="mr-2"
            value={HashiCorpCredentialType.onPrem}
            checked={credentialType === HashiCorpCredentialType.onPrem}
            onChange={() => setCredentialType(HashiCorpCredentialType.onPrem)}
          />
          <label className="mr-8 w-32 pt-0" htmlFor="hashiCorpEnvironmentTypeChoice-onPrem">
            On-Premises
          </label>

          <input
            type="radio"
            id="hashiCorpEnvironmentTypeChoice-cloud"
            name="type"
            className="mr-2"
            value={HashiCorpCredentialType.cloud}
            checked={credentialType === HashiCorpCredentialType.cloud}
            onChange={() => setCredentialType(HashiCorpCredentialType.cloud)}
          />
          <label className="pt-0" htmlFor="hashiCorpEnvironmentTypeChoice-cloud">
            Cloud
          </label>
        </div>
      </div>
      {credentialType === HashiCorpCredentialType.onPrem && (
        <>
          <div>
            <label>Auth Method:</label>
            <div className="mt-2 flex flex-row">
              <input
                type="radio"
                id="authMethodChoice-appRole"
                name="authMethod"
                className="mr-2"
                value={HashiCorpVaultAuthMethod.appRole}
                checked={credentialAuthMethod === HashiCorpVaultAuthMethod.appRole}
                onChange={() => setAuthMethod(HashiCorpVaultAuthMethod.appRole)}
              />
              <label className="mr-8 w-32 pt-0" htmlFor="authMethodChoice-appRole">
                AppRole
              </label>

              <input
                type="radio"
                id="authMethodChoice-token"
                name="authMethod"
                className="mr-2"
                value={HashiCorpVaultAuthMethod.token}
                checked={credentialAuthMethod === HashiCorpVaultAuthMethod.token}
                onChange={() => setAuthMethod(HashiCorpVaultAuthMethod.token)}
              />
              <label className="pt-0" htmlFor="authMethodChoice-token">
                Token
              </label>
            </div>
          </div>
          <TextField
            className="flex flex-col gap-2"
            defaultValue={(credentials as HashiCorpOnPremCredential).serverAddress}
          >
            <Label className="col-span-4">
              Server Address:
              <HelpTooltip className="space-left ml-2">
                HashiCorp on-prem server address like https://localhost:8200
              </HelpTooltip>
            </Label>
            <Input
              required
              className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
              type="text"
              name="serverAddress"
              onChange={e => validateServerAddress(e.target.value)}
              placeholder="Server Address"
            />
          </TextField>
          {!isValidUrl && (
            <p className="notice error margin-top-sm no-margin-bottom">
              Invalid server address, please check and input again
            </p>
          )}
          {credentialAuthMethod === HashiCorpVaultAuthMethod.token && (
            <TextField
              className="flex flex-col gap-2"
              defaultValue={(credentials as VaultTokenCredential).access_token}
            >
              <Label className="col-span-4">Authentication Token:</Label>
              <div className="flex items-center gap-2">
                <Input
                  required
                  className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                  type={hideValueItemNames.includes('access_token') ? 'password' : 'text'}
                  name="access_token"
                  placeholder="Authentication Token"
                />
                <Button
                  className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={() => showOrHideItemValue('access_token')}
                >
                  {hideValueItemNames.includes('access_token') ? (
                    <i className="fa fa-eye-slash" />
                  ) : (
                    <i className="fa fa-eye" />
                  )}
                </Button>
              </div>
            </TextField>
          )}
          {credentialAuthMethod === HashiCorpVaultAuthMethod.appRole && (
            <>
              <TextField className="flex flex-col gap-2" defaultValue={(credentials as VaultAppRoleCredential).role_id}>
                <Label className="col-span-4">Role Id:</Label>
                <Input
                  required
                  className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                  type="text"
                  name="role_id"
                  placeholder="Role Id"
                />
              </TextField>
              <TextField
                className="flex flex-col gap-2"
                defaultValue={(credentials as VaultAppRoleCredential).secret_id}
              >
                <Label className="col-span-4">Secret Id:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    required
                    className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                    type={hideValueItemNames.includes('secret_id') ? 'password' : 'text'}
                    name="secret_id"
                    placeholder="Secret Id"
                  />
                  <Button
                    className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                    onPress={() => showOrHideItemValue('secret_id')}
                  >
                    {hideValueItemNames.includes('secret_id') ? (
                      <i className="fa fa-eye-slash" />
                    ) : (
                      <i className="fa fa-eye" />
                    )}
                  </Button>
                </div>
              </TextField>
            </>
          )}
        </>
      )}
      {credentialType === HashiCorpCredentialType.cloud && (
        <>
          <TextField className="flex flex-col gap-2" defaultValue={(credentials as HCPCredential).client_id}>
            <Label className="col-span-4">Client Id:</Label>
            <Input
              required
              className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
              type="text"
              name="client_id"
              placeholder="Client Id"
            />
          </TextField>
          <TextField className="flex flex-col gap-2" defaultValue={(credentials as HCPCredential).client_secret}>
            <Label className="col-span-4">Client Secret:</Label>
            <div className="flex items-center gap-2">
              <Input
                required
                className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                type={hideValueItemNames.includes('client_secret') ? 'password' : 'text'}
                name="client_secret"
                placeholder="Client Secret"
              />
              <Button
                className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                onPress={() => showOrHideItemValue('client_secret')}
              >
                {hideValueItemNames.includes('client_secret') ? (
                  <i className="fa fa-eye-slash" />
                ) : (
                  <i className="fa fa-eye" />
                )}
              </Button>
            </div>
          </TextField>
        </>
      )}
      {errorMessage && <p className="notice error margin-top-sm no-margin-bottom">{errorMessage}</p>}
      <div className="flex w-full flex-row items-center justify-end gap-[--padding-md] pt-[--padding-md]">
        <Button
          className="rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-right text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
          type="submit"
          isDisabled={isLoading || !isValidUrl}
        >
          {isLoading && <Icon icon="spinner" className="m-auto mr-2 inline-block animate-spin text-[--color-font]" />}
          {isEdit ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
