import { autoBindMethodsForReact } from 'class-autobind-decorator';
import electron from 'electron';
import fs from 'fs';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import * as misc from '../../../../common/misc';
import { FileInputButton } from '../../base/file-input-button';
import { PromptButton } from '../../base/prompt-button';

interface Props {
  onChange: (path: string) => void;
  path: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class FileEditor extends PureComponent<Props> {
  _handleResetFile() {
    this.props.onChange('');
  }

  _handleChooseFile(path: string) {
    this.props.onChange(path);
  }

  render() {
    const { path } = this.props;
    // Replace home path with ~/ to make the path shorter
    const homeDirectory = electron.remote.app.getPath('home');
    const pathDescription = path.replace(homeDirectory, '~');
    let sizeDescription = '';

    try {
      const bytes = fs.statSync(path).size;
      sizeDescription = misc.describeByteSize(bytes);
    } catch (e) {
      sizeDescription = '';
    }

    return (
      <div className="text-center">
        <div className="pad text-left">
          <label className="label--small">Selected File</label>
          {path ? (
            <code className="block txt-sm">
              <span className="force-wrap selectable" title={path}>
                {pathDescription}
              </span>{' '}
              <span className="no-wrap">({sizeDescription})</span>
            </code>
          ) : (
            <code className="super-faint block txt-sm">No file selected</code>
          )}
        </div>
        <div>
          <PromptButton
            className="btn btn--super-compact"
            disabled={!path}
            onClick={this._handleResetFile}
          >
            Reset File
          </PromptButton>
          &nbsp;&nbsp;
          <FileInputButton
            path={path}
            className="btn btn--clicky"
            onChange={this._handleChooseFile}
          />
        </div>
      </div>
    );
  }
}
