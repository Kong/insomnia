import type { OpenDialogOptions } from 'electron';
import React from 'react';
import { Button, Input } from 'react-aria-components';

import { Icon } from '../../icon';

export interface FilePickerProps {
  name: string;
  ariaLabel?: string;
  value: string;
  placeholder: string;
  filePickerOptions: OpenDialogOptions;
  onSelectFile: (filePath: string) => void;
};

export const FilePicker = (props: FilePickerProps) => {
  const { name, value, placeholder, ariaLabel, filePickerOptions, onSelectFile } = props;

  const handleSelectFile = async () => {
    const { canceled, filePaths } = await window.dialog.showOpenDialog(filePickerOptions);
    if (canceled) {
      return;
    }
    const selectedFile = filePaths[0];
    onSelectFile(selectedFile);
  };

  return (
    <>
      <Input
        className='py-1 w-4/5 pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
        placeholder={placeholder}
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={e => onSelectFile(e.target.value)}
      />
      <Button
        className="flex-shrink-0 border-solid border border-[--hl-`sm] py-1 items-center justify-center px-4 aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent transition-all text-base"
        onPress={handleSelectFile}
      >
        <Icon icon="file" className='mr-2' />
        <span>Select File</span>
      </Button>
    </>
  );
};
