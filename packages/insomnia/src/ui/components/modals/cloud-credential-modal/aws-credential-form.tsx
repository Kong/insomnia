import React, { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import { AWSCredentialType, type BaseCloudCredential, type CloudProviderCredential, type CloudProviderName } from '../../../../models/cloud-credential';
import { Icon } from '../../icon';

export interface AWSCredentialFormProps {
  data?: CloudProviderCredential;
  onSubmit: (newData: BaseCloudCredential) => void;
  isLoading: boolean;
  errorMessage?: string;
}
const initialFormValue = {
  name: '',
  credentials: {
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    region: '',
  },
};
export const providerType: CloudProviderName = 'aws';

const ToggleBtn = (props: { isHidden: boolean; onShowHideInput: () => void }) => {
  const { isHidden, onShowHideInput } = props;
  return (
    <Button
      className="px-4 h-8 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
      onPress={onShowHideInput}
    >
      {isHidden ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
    </Button>
  );
};

export const AWSCredentialForm = (props: AWSCredentialFormProps) => {
  const { data, onSubmit, isLoading, errorMessage } = props;
  const isEdit = !!data;
  const { name, credentials } = data || initialFormValue;
  const { accessKeyId, secretAccessKey, sessionToken, region } = credentials!;
  const [hideValueItemNames, setHideValueItemNames] = useState(['accessKeyId', 'secretAccessKey', 'sessionToken']);

  const showOrHideItemValue = (name: string) => {
    if (hideValueItemNames.includes(name)) {
      setHideValueItemNames(hideValueItemNames.filter(n => n !== name));
    } else {
      setHideValueItemNames([...hideValueItemNames, name]);
    }
  };

  return (
    <form
      className='flex flex-col gap-2 flex-shrink-0'
      onSubmit={e => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const { name, accessKeyId, secretAccessKey, sessionToken, region } = Object.fromEntries(formData.entries()) as Record<string, string>;
        // hard-code here since we only support AWS temporary token for now
        const type = AWSCredentialType.temp;
        const newData = {
          name,
          provider: providerType,
          credentials: { accessKeyId, secretAccessKey, sessionToken, region, type },
        };
        onSubmit(newData);
      }}
    >
      <div className='flex flex-col gap-2'>
        <TextField
          className="flex flex-col gap-2"
          defaultValue={name}
        >
          <Label className='col-span-4'>
            Credential Name:
          </Label>
          <Input
            required
            className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
            type="text"
            name="name"
            placeholder="Credential name"
          />
        </TextField>
        <TextField
          className="flex flex-col gap-2"
          defaultValue={accessKeyId}
        >
          <Label className='col-span-4'>
            Access Key Id:
          </Label>
          <div className='flex items-center gap-2'>
            <Input
              required
              className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
              type={hideValueItemNames.includes('accessKeyId') ? 'password' : 'text'}
              name="accessKeyId"
              placeholder="Access Key Id"
            />
            <ToggleBtn
              isHidden={hideValueItemNames.includes('accessKeyId')}
              onShowHideInput={() => showOrHideItemValue('accessKeyId')}
            />
          </div>
        </TextField>
        <TextField
          className="flex flex-col gap-2"
          defaultValue={secretAccessKey}
        >
          <Label className='col-span-4'>
            Secret Access Key:
          </Label>
          <div className='flex items-center gap-2'>
            <Input
              required
              className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
              type={hideValueItemNames.includes('secretAccessKey') ? 'password' : 'text'}
              name="secretAccessKey"
              placeholder="Secret Access Key"
            />
            <ToggleBtn
              isHidden={hideValueItemNames.includes('secretAccessKey')}
              onShowHideInput={() => showOrHideItemValue('secretAccessKey')}
            />
          </div>
        </TextField>
        <TextField
          className="flex flex-col gap-2"
          defaultValue={sessionToken}
        >
          <Label className='col-span-4'>
            Session Token:
          </Label>
          <div className='flex items-center gap-2'>
            <Input
              required
              className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
              type={hideValueItemNames.includes('sessionToken') ? 'password' : 'text'}
              name="sessionToken"
              placeholder="AWS Secret Token"
            />
            <ToggleBtn
              isHidden={hideValueItemNames.includes('sessionToken')}
              onShowHideInput={() => showOrHideItemValue('sessionToken')}
            />
          </div>
        </TextField>
        <TextField
          className="flex flex-col gap-2"
          defaultValue={region}
        >
          <Label className='col-span-4'>
            Region:
          </Label>
          <Input
            required
            className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
            type="text"
            name="region"
            placeholder="Region"
          />
        </TextField>
      </div>
      {errorMessage &&
        <p className="notice error margin-top-sm no-margin-bottom">{errorMessage}</p>
      }
      <div className='w-full flex flex-row items-center justify-end gap-[--padding-md] pt-[--padding-md]'>
        <Button
          className="hover:no-underline text-right bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
          type='submit'
          isDisabled={isLoading}
        >
          {isLoading && <Icon icon="spinner" className="text-[--color-font] animate-spin m-auto inline-block mr-2" />}
          {isEdit ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};
