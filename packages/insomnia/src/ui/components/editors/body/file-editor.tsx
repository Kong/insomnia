import React, { type FC, useCallback } from 'react';

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

  const _handleChooseFile = useCallback(
    (path: string) => {
      onChange(path);
    },
    [onChange],
  );

  // Replace home path with ~/ to make the path shorter
  const homeDirectory = window.app.getPath('home');
  const pathDescription = path.replace(homeDirectory, '~');

  return (
    <div className="text-center">
      <div className="pad text-left">
        <label className="label--small">Selected File</label>
        {path ? (
          <code className="txt-sm block">
            <span className="force-wrap selectable" title={path}>
              {pathDescription}
            </span>
          </code>
        ) : (
          <code className="super-faint txt-sm block">No file selected</code>
        )}
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
