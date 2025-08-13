import React, { useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import type { CloudProviderCredential, CloudProviderName } from '../../../../models/cloud-credential';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';

type GCPCloudCredential = Extract<CloudProviderCredential, { provider: 'gcp' }>;
export interface GCPCredentialFormProps {
  data?: GCPCloudCredential;
  onSubmit: (newData: GCPCloudCredential) => void;
  isLoading: boolean;
  errorMessage?: string;
}
const initialFormValue = {
  name: '',
};
export const providerType: CloudProviderName = 'gcp';

export const GCPCredentialForm = (props: GCPCredentialFormProps) => {
  const { data, onSubmit, isLoading, errorMessage } = props;
  const [inputKeyPath, setInputKeyPath] = useState(
    // for backward compatibility, gcp credential used to be a string of service account key file path
    typeof data?.credentials === 'string' ? data?.credentials : data?.credentials?.serviceAccountKeyFilePath || '',
  );
  const isEdit = !!data;
  const { name } = data || initialFormValue;

  const handleSelectFile = async () => {
    const { canceled, filePaths } = await window.dialog.showOpenDialog({
      title: 'Select Service Account Key File',
      buttonLabel: 'Select',
      properties: ['openFile'],
      filters: [{ name: 'JSON File', extensions: ['json'] }],
    });
    if (canceled) {
      return;
    }
    const selectedFile = filePaths[0];
    setInputKeyPath(selectedFile);
  };

  return (
    <form
      className="flex flex-shrink-0 flex-col gap-2"
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(e.currentTarget);
        const { name } = Object.fromEntries(formData.entries()) as Record<string, string>;
        const newData = {
          name,
          provider: providerType,
          credentials: {
            serviceAccountKeyFilePath: inputKeyPath!,
          },
        };
        onSubmit(newData as GCPCloudCredential);
      }}
    >
      <div className="flex flex-col gap-2">
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
          <label>
            Service Account Key File Path:
            <HelpTooltip className="space-left ml-2">
              Enter the path of your service account key file which is generated in GCP console
            </HelpTooltip>
          </label>
        </div>
        <div className="mt-2 flex gap-3">
          <Input
            className="col-span-3 w-4/5 flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
            placeholder="Service account key path"
            aria-label="Input Service Account Key Path"
            value={inputKeyPath}
            onChange={e => setInputKeyPath(e.target.value)}
          />
          <Button
            className="flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] px-4 py-1 text-base text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm]"
            onPress={handleSelectFile}
          >
            <Icon icon="file" className="mr-2" />
            <span>Select File</span>
          </Button>
        </div>
        {errorMessage && <p className="notice error margin-top-sm no-margin-bottom">{errorMessage}</p>}
        <div className="flex w-full flex-row items-center justify-end gap-[--padding-md] pt-[--padding-md]">
          <Button
            className="rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-right text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
            type="submit"
            isDisabled={isLoading || !inputKeyPath}
          >
            {isLoading && <Icon icon="spinner" className="m-auto mr-2 inline-block animate-spin text-[--color-font]" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </form>
  );
};
