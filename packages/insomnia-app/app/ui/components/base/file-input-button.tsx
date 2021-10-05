import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { basename as pathBasename } from 'path';
import React, { HTMLAttributes, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { selectFileOrFolder } from '../../../common/select-file-or-folder';

interface Props extends Omit<HTMLAttributes<HTMLButtonElement>, 'onChange'> {
  onChange: (path: string) => void;
  path?: string;
  itemtypes?: ('file' | 'directory')[];
  extensions?: string[];
  showFileName?: boolean;
  showFileIcon?: boolean;
  name?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class FileInputButton extends PureComponent<Props> {
  _button: HTMLButtonElement | null = null;

  focus() {
    this._button?.focus();
  }

  focusEnd() {
    this._button?.focus();
  }

  _setRef(n: HTMLButtonElement) {
    this._button = n;
  }

  async _handleChooseFile() {
    const { canceled, filePath } = await selectFileOrFolder({
      itemTypes: this.props.itemtypes,
      extensions: this.props.extensions,
    });

    // Only change the file if a new file was selected
    if (canceled) {
      return;
    }

    this.props.onChange(filePath);
  }

  render() {
    const { showFileName, showFileIcon, path, name, onChange, ...extraProps } = this.props;
    // NOTE: Basename fails if path is not a string, so let's make sure it is
    const fileName = typeof path === 'string' ? pathBasename(path) : null;
    return (
      <button
        type="button"
        ref={this._setRef}
        onClick={this._handleChooseFile}
        title={path}
        {...extraProps}
      >
        {showFileIcon && <i className="fa fa-file-o space-right" />}
        {showFileName && fileName ? `${fileName}` : `Choose ${name || 'File'}`}
      </button>
    );
  }
}
