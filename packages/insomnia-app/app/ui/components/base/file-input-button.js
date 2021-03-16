// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { basename as pathBasename } from 'path';
import { remote } from 'electron';

type Props = {
  // Required
  onChange: Function,
  path: string,

  // Optional
  itemtypes?: Array<string>,
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
    // If no types are selected then default to just files and not directories
    const types = this.props.itemtypes ? this.props.itemtypes : ['file'];
    let title = 'Select ';
    if (types.includes('file')) {
      title += ' File';
      if (types.length > 2) {
        title += ' or';
      }
    }
    if (types.includes('directory')) {
      title += ' Directory';
    }
    const options = {
      title: title,
      buttonLabel: 'Select',
      properties: types.map(type => {
        console.log('TYPE', type);
        if (type === 'file') {
          return 'openFile';
        }
        if (type === 'directory') {
          return 'openDirectory';
        }
      }),
      filters: [{ name: 'All Files', extensions: ['*'] }],
    };

    // If extensions are provided then filter for just those extensions
    if (this.props.extensions) {
      options.filters = [{ name: 'Files', extensions: this.props.extensions }];
    }

    const { canceled, filePaths } = await remote.dialog.showOpenDialog(options);

    // Only change the file if a new file was selected
    if (canceled) {
      return;
    }

    const path = filePaths[0];
    this.props.onChange(path);
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
