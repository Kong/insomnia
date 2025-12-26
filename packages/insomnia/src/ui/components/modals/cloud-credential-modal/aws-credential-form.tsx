import React, { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import {
  AWSCredentialType,
  type AWSFileCredential,
  type AWSTemporaryCredential,
  type CloudProviderCredential,
  type CloudProviderName,
} from '../../../../models/cloud-credential';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';
import { FilePicker } from './file-picker';

type AWSCloudCredential = Extract<CloudProviderCredential, { provider: 'aws' }>;
export interface AWSCredentialFormProps {
  data?: CloudProviderCredential;
  onSubmit: (newData: AWSCloudCredential) => void;
  isLoading: boolean;
  errorMessage?: string;
}
const initialFormValue: { name: string; credentials: Required<AWSCloudCredential>['credentials'] } = {
  name: '',
  credentials: {
    type: AWSCredentialType.temp,
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    region: '',
  },
};
export const providerType: CloudProviderName = 'aws';

export const AWSCredentialForm = (props: AWSCredentialFormProps) => {
  const { data, onSubmit, isLoading, errorMessage } = props;
  const isEdit = !!data;
  const { name, credentials = initialFormValue.credentials } = (data || initialFormValue) as {
    name: string;
    credentials: AWSCloudCredential['credentials'];
  };
  const { type, region } = credentials;
  const [hideValueItemNames, setHideValueItemNames] = useState(['accessKeyId', 'secretAccessKey', 'sessionToken']);
  const [credentialFilePath, setCredentialFilePath] = useState(
    type === AWSCredentialType.file || type === AWSCredentialType.sso ? credentials.filePath : '',
  );
  const [configFilePath, setConfigFilePath] = useState(
    type === AWSCredentialType.sso ? credentials.configFilePath : '',
  );
  const [credentialType, setCredentialType] = useState<AWSCredentialType>(type);

  const showOrHideItemValue = (name: string) => {
    if (hideValueItemNames.includes(name)) {
      setHideValueItemNames(hideValueItemNames.filter(n => n !== name));
    } else {
      setHideValueItemNames([...hideValueItemNames, name]);
    }
  };

  return (
    <form
      className="flex shrink-0 flex-col gap-2 p-(--padding-sm)"
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(e.currentTarget);
        const {
          name,
          type,
          region,
          // temporary credential config
          accessKeyId,
          secretAccessKey,
          sessionToken,
          // file credential config
          section,
          filePath,
          configFilePath,
          enableCache,
        } = Object.fromEntries(formData.entries()) as Record<string, string>;
        const commonData = { name, provider: providerType };
        let newData;
        if (type === AWSCredentialType.temp) {
          newData = {
            ...commonData,
            credentials: {
              type: type as AWSCredentialType.temp,
              accessKeyId,
              secretAccessKey,
              sessionToken,
              region,
            },
          };
        } else if (type === AWSCredentialType.file) {
          newData = {
            ...commonData,
            credentials: {
              type: type as AWSCredentialType.file,
              region,
              section,
              ...(typeof filePath === 'string' && filePath.length > 0 && { filePath }),
              enableCache: !!enableCache,
            },
          };
        } else {
          newData = {
            ...commonData,
            credentials: {
              type: type as AWSCredentialType.sso,
              region,
              section,
              ...(typeof filePath === 'string' && filePath.length > 0 && { filePath }),
              ...(typeof configFilePath === 'string' && configFilePath.length > 0 && { configFilePath }),
              enableCache: !!enableCache,
            },
          };
        }
        onSubmit(newData as AWSCloudCredential);
      }}
    >
      <div className="flex flex-col gap-2">
        <TextField className="flex flex-col gap-2" defaultValue={name}>
          <Label className="col-span-4">Credential Name:</Label>
          <Input
            required
            className="col-span-3 h-8 w-full flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
            type="text"
            name="name"
            placeholder="Credential name"
          />
        </TextField>
        <div>
          <label>Credential Type:</label>
          <div className="mt-2 flex flex-row">
            <input
              type="radio"
              id="awsCredentialType-temp"
              name="type"
              className="mr-2"
              value={AWSCredentialType.temp}
              checked={credentialType === AWSCredentialType.temp}
              onChange={() => setCredentialType(AWSCredentialType.temp)}
            />
            <label className="mr-8 w-48 pt-0" htmlFor="awsCredentialType-temp">
              Temporary Credential
            </label>
            <input
              type="radio"
              id="awsCredentialType-file"
              name="type"
              className="mr-2"
              value={AWSCredentialType.file}
              checked={credentialType === AWSCredentialType.file}
              onChange={() => setCredentialType(AWSCredentialType.file)}
            />
            <label className="mr-8 w-48 pt-0" htmlFor="awsCredentialType-file">
              Credential File
            </label>
            <input
              type="radio"
              id="awsCredentialType-sso"
              name="type"
              className="mr-2"
              value={AWSCredentialType.sso}
              checked={credentialType === AWSCredentialType.sso}
              onChange={() => setCredentialType(AWSCredentialType.sso)}
            />
            <label className="pt-0" htmlFor="awsCredentialType-sso">
              SSO Credential
            </label>
          </div>
          {credentialType === AWSCredentialType.temp && (
            <>
              <TextField
                className="flex flex-col gap-2"
                defaultValue={(credentials as AWSTemporaryCredential).accessKeyId}
              >
                <Label className="col-span-4">Access Key Id:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    required
                    className="col-span-3 h-8 w-full flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                    type={hideValueItemNames.includes('accessKeyId') ? 'password' : 'text'}
                    name="accessKeyId"
                    placeholder="Access Key Id"
                  />
                  <Button
                    className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={() => showOrHideItemValue('accessKeyId')}
                  >
                    {hideValueItemNames.includes('accessKeyId') ? (
                      <i className="fa fa-eye-slash" />
                    ) : (
                      <i className="fa fa-eye" />
                    )}
                  </Button>
                </div>
              </TextField>
              <TextField
                className="flex flex-col gap-2"
                defaultValue={(credentials as AWSTemporaryCredential).secretAccessKey}
              >
                <Label className="col-span-4">Secret Access Key:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    required
                    className="col-span-3 h-8 w-full flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                    type={hideValueItemNames.includes('secretAccessKey') ? 'password' : 'text'}
                    name="secretAccessKey"
                    placeholder="Secret Access Key"
                  />
                  <Button
                    className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={() => showOrHideItemValue('secretAccessKey')}
                  >
                    {hideValueItemNames.includes('secretAccessKey') ? (
                      <i className="fa fa-eye-slash" />
                    ) : (
                      <i className="fa fa-eye" />
                    )}
                  </Button>
                </div>
              </TextField>
              <TextField
                className="flex flex-col gap-2"
                defaultValue={(credentials as AWSTemporaryCredential).sessionToken}
              >
                <Label className="col-span-4">Session Token:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    required
                    className="col-span-3 h-8 w-full flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                    type={hideValueItemNames.includes('sessionToken') ? 'password' : 'text'}
                    name="sessionToken"
                    placeholder="AWS Secret Token"
                  />
                  <Button
                    className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={() => showOrHideItemValue('sessionToken')}
                  >
                    {hideValueItemNames.includes('sessionToken') ? (
                      <i className="fa fa-eye-slash" />
                    ) : (
                      <i className="fa fa-eye" />
                    )}
                  </Button>
                </div>
              </TextField>
            </>
          )}
          {credentialType === AWSCredentialType.sso && (
            <>
              <div className="mt-2">
                <label>
                  Config File Path:
                  <HelpTooltip className="space-left ml-2">
                    The path to the shared config file, leave blank for default location generated by AWS CLI
                  </HelpTooltip>
                </label>
              </div>
              <div className="mt-2 flex gap-3">
                <FilePicker
                  placeholder="Input AWS config file path, leave blank for default location"
                  ariaLabel="AWS Config File Path:"
                  name="configFilePath"
                  value={configFilePath || ''}
                  onSelectFile={filePath => setConfigFilePath(filePath)}
                  filePickerOptions={{
                    title: 'Select Credential File Path',
                    buttonLabel: 'Select',
                    properties: ['openFile'],
                  }}
                />
              </div>
            </>
          )}
          {(credentialType === AWSCredentialType.file || credentialType === AWSCredentialType.sso) && (
            <>
              <div className="mt-2">
                <label>
                  Credential File Path:
                  <HelpTooltip className="space-left ml-2">
                    The path to the shared credentials file, leave blank for default location generated by AWS CLI
                  </HelpTooltip>
                </label>
              </div>
              <div className="mt-2 flex gap-3">
                <FilePicker
                  placeholder="Input AWS credential file path, leave blank for default location"
                  ariaLabel="AWS Credential File Path:"
                  name="filePath"
                  value={credentialFilePath || ''}
                  onSelectFile={filePath => setCredentialFilePath(filePath)}
                  filePickerOptions={{
                    title: 'Select Config File Path',
                    buttonLabel: 'Select',
                    properties: ['openFile'],
                  }}
                />
              </div>
              <TextField className="flex flex-col gap-2" defaultValue={(credentials as AWSFileCredential).section}>
                <Label className="col-span-4">
                  {credentialType === AWSCredentialType.file ? 'Section Name:' : 'Profile Name:'}
                </Label>
                <Input
                  required
                  className="col-span-3 h-8 w-full flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                  type="text"
                  name="section"
                  placeholder={
                    credentialType === AWSCredentialType.file
                      ? 'Section name of the credential in the file'
                      : 'Profile name of the configuration to use in the config file'
                  }
                />
              </TextField>
              <div className="mt-2">
                <label className="flex items-center gap-2">
                  <Input
                    type="checkbox"
                    name="enableCache"
                    defaultChecked={(credentials as AWSFileCredential).enableCache}
                  />
                  Enable Credential Cache
                  <HelpTooltip className="space-left">
                    Determines whether the system should cache the credentials or read them from the local file every
                    time.
                  </HelpTooltip>
                </label>
              </div>
            </>
          )}
          <TextField className="flex flex-col gap-2" defaultValue={region}>
            <Label className="col-span-4">Region:</Label>
            <Input
              required
              className="col-span-3 h-8 w-full flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
              type="text"
              name="region"
              placeholder="Region"
            />
          </TextField>
        </div>
        {errorMessage && <p className="notice error margin-top-sm no-margin-bottom">{errorMessage}</p>}
        <div className="flex w-full flex-row items-center justify-end gap-(--padding-md) pt-(--padding-md)">
          <Button
            className="rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-right text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
            type="submit"
            isDisabled={isLoading}
          >
            {isLoading && <Icon icon="spinner" className="m-auto mr-2 inline-block animate-spin text-(--color-font)" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </form>
  );
};
