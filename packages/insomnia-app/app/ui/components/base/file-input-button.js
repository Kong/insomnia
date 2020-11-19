// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { basename as pathBasename } from 'path';
import selectFileOrFolder from '../../../common/select-file-or-folder';

type Props = {
  // Required
  onChange: (path: string) => void,

  // Optional
  path?: string,
  itemtypes?: Array<'file' | 'directory'>,
  extensions?: Array<string>,
  showFileName?: boolean,
  showFileIcon?: boolean,
  name?: string,
};

@autobind
class FileInputButton extends React.PureComponent<Props> {
  _button: ?HTMLButtonElement;

  focus() {
    this._button && this._button.focus();
  }

  focusEnd() {
    this._button && this._button.focus();
  }

  _setRef(n: ?HTMLButtonElement) {
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
    const { showFileName, showFileIcon, path, name, ...extraProps } = this.props;

    // NOTE: Basename fails if path is not a string, so let's make sure it is
    const fileName = typeof path === 'string' ? pathBasename(path) : null;

    return (
      <button
        type="button"
        ref={this._setRef}
        onClick={this._handleChooseFile}
        title={path}
        {...(extraProps: Object)}>
        {showFileIcon && <i className="fa fa-file-o space-right" />}
        {showFileName && fileName ? `${fileName}` : `Choose ${name || 'File'}`}
      </button>
    );
  }
}

export default FileInputButton;
