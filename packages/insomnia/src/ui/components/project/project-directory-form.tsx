import type { FC } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';

import { selectFileOrFolder } from '~/common/select-file-or-folder';

import { Icon } from '../icon';

interface Props {
  directoryPath?: string;
  onChange: (directoryPath: string) => void;
}

export const ProjectDirectoryForm: FC<Props> = ({ directoryPath, onChange }) => {
  const handleBrowse = async () => {
    const { filePath, canceled } = await selectFileOrFolder({ itemTypes: ['directory'] });

    if (!canceled && filePath) {
      onChange(filePath);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-0.5">
      <TextField value={directoryPath || ''} className="group relative flex flex-col gap-2">
        <Label className="pt-0 text-sm text-(--color-font)">Project directory</Label>
        <div className="flex items-center gap-2">
          <Input
            isReadOnly
            placeholder="Select a local folder"
            className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
          />
          <Button
            onPress={handleBrowse}
            className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-3 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
          >
            <Icon icon="folder-open" />
            <span>Browse</span>
          </Button>
        </div>
      </TextField>
      <p className="text-xs text-(--hl)">Workspace data will be stored as Insomnia files in this folder.</p>
    </div>
  );
};
