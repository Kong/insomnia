import fs from 'fs';
import React, { FC, useCallback } from 'react';

import * as misc from '../../../../common/misc';
import { FileInputButton } from '../../base/file-input-button';
import { PromptButton } from '../../base/prompt-button';

interface Props {
  onChange: (path: string) => void;
  path: string;
}

export const FileEditor: FC<Props> = ({ onChange, path }) => {
  const _handleResetFile = useCallback(() => {
    onChange('');
  }, [onChange]);

  const _handleChooseFile = useCallback((path: string) => {
    onChange(path);
  }, [onChange]);

  // Replace home path with ~/ to make the path shorter
  const homeDirectory = window.app.getPath('home');
  const pathDescription = path.replace(homeDirectory, '~');
  let sizeDescription = '';

  try {
    const bytes = fs.statSync(path).size;
    sizeDescription = misc.describeByteSize(bytes);
  } catch (error) {
    sizeDescription = '';
  }

  return (
    <div className="text-center">
      <div className="pad text-left">
        <label className="label--small">Selected File</label>
        {path ? <code className="block txt-sm">
          <span className="force-wrap selectable" title={path}>
            {pathDescription}
          </span>{' '}
          <span className="no-wrap">({sizeDescription})</span>
        </code> : <code className="super-faint block txt-sm">No file selected</code>}
      </div>
      <div>
        <PromptButton className="btn btn--super-compact" disabled={!path} onClick={_handleResetFile}>
          Reset File
        </PromptButton>
          &nbsp;&nbsp;
        <FileInputButton path={path} className="btn btn--clicky" onChange={_handleChooseFile} />
      </div>
    </div>
  );
};
