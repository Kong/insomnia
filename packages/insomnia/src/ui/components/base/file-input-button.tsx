import { selectFileOrFolder } from '@insomnia/common/select-file-or-folder';
import { basename as pathBasename } from 'path';
import React, { HTMLAttributes, useCallback } from 'react';

interface Props extends Omit<HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  onChange: (path: string) => void;
  path?: string;
  itemtypes?: ('file' | 'directory')[];
  extensions?: string[];
  showFileName?: boolean;
  showFileIcon?: boolean;
  name?: string;
}

export const FileInputButton = (props: Props) => {
  const { showFileName, showFileIcon, path, name, onChange, itemtypes, extensions, ...extraProps } = props;
  // NOTE: Basename fails if path is not a string, so let's make sure it is
  const fileName = typeof path === 'string' ? pathBasename(path) : null;
  const _handleChooseFile =  useCallback(async () => {
    const { canceled, filePath } = await selectFileOrFolder({
      itemTypes: itemtypes,
      extensions,
    });

    // Only change the file if a new file was selected
    if (canceled) {
      return;
    }

    onChange(filePath);
  }, [extensions, itemtypes, onChange]);
  return (
    <button
      type="button"
      onClick={_handleChooseFile}
      title={path}
      {...extraProps}
    >
      {showFileIcon && <i className="fa fa-file-o space-right" />}
      {showFileName && fileName ? `${fileName}` : `Choose ${name || 'File'}`}
    </button>
  );
};
