import type { JWTInput } from 'google-auth-library';
import React, { useState } from 'react';
import { Button, FileTrigger, Input, Label, TextField } from 'react-aria-components';

import { type BaseCloudCredential, type CloudProviderCredential, type CloudProviderName } from '../../../../models/cloud-credential';
import { CodeEditor } from '../../codemirror/code-editor';
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
const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
const validateUserInputKey = (serviceAccountKey: object) => {
  let isValidInput = true;
  let errorMessage = '';
  requiredFields.every(field => {
    isValidInput = field in serviceAccountKey;
    if (!isValidInput) {
      errorMessage = `Required field: ${field} is missing`;
    }
    return isValidInput;
  });
  return { isValidInput, errorMessage };
};

export const GCPCredentialForm = (props: GCPCredentialFormProps) => {
  const { data, onSubmit, isLoading, errorMessage } = props;
  const [serviceAccountKeyType, setServiceAccountKeyType] = useState<'file' | 'text'>('file');
  const [serviceAccountKey, setServiceAccountKey] = useState<JWTInput | null>(null);
  const [inputKeyError, setInputKeyError] = useState('');
  const isEdit = !!data;
  const { name } = data || initialFormValue;

  const handleEditorChange = (value: string) => {
    setInputKeyError('');
    try {
      const serviceAccountKey = JSON.parse(value);
      const { isValidInput, errorMessage } = validateUserInputKey(serviceAccountKey);
      if (isValidInput) {
        setServiceAccountKey(serviceAccountKey);
      } else {
        setInputKeyError(errorMessage);
      }
    } catch (error) {
      setInputKeyError('Invalid json input, please check and input again');
    };
  };

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList) {
      return;
    };
    setInputKeyError('');
    setServiceAccountKey(null);
    const files = Array.from(fileList);
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const content = e.target?.result as string;
      if (file.type === 'application/json') {
        try {
          const serviceAccountKey = JSON.parse(content);
          const { isValidInput, errorMessage } = validateUserInputKey(serviceAccountKey);
          if (isValidInput) {
            setServiceAccountKey(serviceAccountKey);
          } else {
            setInputKeyError(errorMessage);
          }
        } catch (error) {
          setInputKeyError('Unsupported file is unsupported');
        }
      } else {
        setInputKeyError(`Uploaded file is unsupported type ${file.type}`);
      }
    };
    reader.onerror = () => {
      setInputKeyError(`Failed to read file ${reader.error?.message}`);
    };
    reader.readAsText(file);
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
          credentials: serviceAccountKey!,
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
            Service Account Key:
            <HelpTooltip className='ml-2 sapce-left'>Upload or input your service account key generated in GCP</HelpTooltip>
          </label>
          <div className='mt-2 flex flex-row'>
            <input
              type="radio"
              id="serviceAccountKeyTypeChoice-file"
              name="serviceAccountKeyType"
              className='mr-2'
              value="file"
              checked={serviceAccountKeyType === 'file'}
              onChange={() => {
                setServiceAccountKey(null);
                setInputKeyError('');
                setServiceAccountKeyType('file');
              }}
            />
            <label className="pt-0 mr-8" htmlFor="serviceAccountKeyTypeChoice-file">Upload File</label>

            <input
              type="radio"
              id="serviceAccountKeyTypeChoice-text"
              name="serviceAccountKeyType"
              className='mr-2'
              value="text"
              checked={serviceAccountKeyType === 'text'}
              onChange={() => {
                setServiceAccountKey(null);
                setInputKeyError('');
                setServiceAccountKeyType('text');
              }}
            />
            <label className="pt-0" htmlFor="serviceAccountKeyTypeChoice-text">Input Key</label>
          </div>
        </div>
        {serviceAccountKeyType === 'file' ?
          <div className='mt-2'>
            <FileTrigger
              allowsMultiple={false}
              onSelect={handleFileSelect}
              acceptedFileTypes={['.json']}
            >
              <Button className="flex flex-1 flex-shrink-0 border-solid border border-[--hl-`sm] py-1 gap-2 items-center justify-center px-4 aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent transition-all text-base">
                <Icon icon="upload" />
                <span>{serviceAccountKey ? 'Change Key File' : 'Select Key File'}</span>
              </Button>
            </FileTrigger>
          </div> :
          <div className='h-80 bg-[--hl-xs] rounded'>
            <CodeEditor
              id='gcp-service-account-key-editor'
              mode='json'
              placeholder='Input your service account key json content'
              enableNunjucks={false}
              onChange={handleEditorChange}
              hideGutters
              hideLineNumbers
            />
          </div>
        }
        {(errorMessage || inputKeyError) &&
          <p className="notice error margin-top-sm no-margin-bottom">{errorMessage || inputKeyError}</p>
        }
        <div className='w-full flex flex-row items-center justify-end gap-[--padding-md] pt-[--padding-md]'>
          <Button
            className="hover:no-underline text-right bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
            type='submit'
            isDisabled={isLoading || !serviceAccountKey}
          >
            {isLoading && <Icon icon="spinner" className="text-[--color-font] animate-spin m-auto inline-block mr-2" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </form >
  );
};
