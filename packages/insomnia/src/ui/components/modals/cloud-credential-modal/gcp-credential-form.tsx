import React, { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import { type BaseCloudCredential, type CloudProviderCredential, type CloudProviderName } from '../../../../models/cloud-credential';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';

export interface GCPCredentialFormProps {
  data?: CloudProviderCredential;
  onSubmit: (newData: BaseCloudCredential) => void;
  isLoading: boolean;
  errorMessage?: string;
}
const initialFormValue = {
  name: '',
};
export const providerType: CloudProviderName = 'gcp';

export const GCPCredentialForm = (props: GCPCredentialFormProps) => {
  const { data, onSubmit, isLoading, errorMessage } = props;
  const [inputKeyPath, setInputKeyPath] = useState(data?.credentials as string);
  const isEdit = !!data;
  const { name } = data || initialFormValue;

  const handleSelectFile = async () => {
    const { canceled, filePaths } = await window.dialog.showOpenDialog({
      title: 'Select Service Accont Key File',
      buttonLabel: 'Select',
      properties: ['openFile'],
      filters: [
        { name: 'JSON File', extensions: ['json'] },
      ],
    });
    if (canceled) {
      return;
    }
    const selectedFile = filePaths[0];
    setInputKeyPath(selectedFile);
  };

  return (
    <form
      className='flex flex-col gap-2 flex-shrink-0'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(e.currentTarget);
        const { name } = Object.fromEntries(formData.entries()) as Record<string, string>;
        const newData = {
          name,
          provider: providerType,
          credentials: inputKeyPath!,
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
        <div>
          <label>
            Service Account Key File Path:
            <HelpTooltip className='ml-2 sapce-left'>Enter the path of your service account key file which is generated in GCP console</HelpTooltip>
          </label>
        </div>
        <div className='mt-2 flex gap-3'>
          <Input
            className='py-1 w-4/5 pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
            placeholder="Service account key path"
            aria-label='Input Serice Account Key Path'
            value={inputKeyPath}
            onChange={e => setInputKeyPath(e.target.value)}
          />
          <Button
            className="flex-shrink-0 border-solid border border-[--hl-`sm] py-1 items-center justify-center px-4 aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent transition-all text-base"
            onPress={handleSelectFile}
          >
            <Icon icon="file" className='mr-2' />
            <span>Select File</span>
          </Button>
        </div>
        {(errorMessage) &&
          <p className="notice error margin-top-sm no-margin-bottom">{errorMessage}</p>
        }
        <div className='w-full flex flex-row items-center justify-end gap-[--padding-md] pt-[--padding-md]'>
          <Button
            className="hover:no-underline text-right bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
            type='submit'
            isDisabled={isLoading || !inputKeyPath}
          >
            {isLoading && <Icon icon="spinner" className="text-[--color-font] animate-spin m-auto inline-block mr-2" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </form >
  );
};
