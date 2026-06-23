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
}

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
        className="col-span-3 w-4/5 flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic placeholder:opacity-60 focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
        placeholder={placeholder}
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={e => onSelectFile(e.target.value)}
      />
      <Button
        className="shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) px-4 py-1 text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-selected:bg-(--hl-sm)"
        onPress={handleSelectFile}
      >
        <Icon icon="file" className="mr-2" />
        <span>Select File</span>
      </Button>
    </>
  );
};
