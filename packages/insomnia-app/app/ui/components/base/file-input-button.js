// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { basename as pathBasename } from 'path';
import { OpenDialogOptions, remote } from 'electron';

type Props = {
  // Required
  onChange: Function,
  path: string,

  // Optional
  inputtypes?: Array<string>,
  extensions?: Array<string>,
  showFileName?: boolean,
  showFileIcon?: boolean,
  name?: string
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

  _handleChooseFile() {
    // If no types are selected then default to just files and not directories
    const types = this.props.inputtypes ? this.props.inputtypes : ['openFile'];
    let title = 'Select ';
    if (types.includes('openFile')) {
      title += ' File';
      if (types.length > 2) {
        title += ' or';
      }
    }
    if (types.includes('openDirectory')) {
      title += ' Directory';
    }
    const options: OpenDialogOptions = {
      title: title,
      buttonLabel: 'Select',
      properties: types
    };

    // If extensions are provided then filter for just those extensions
    if (this.props.extensions) {
      options.filters = [{ name: 'Files', extensions: this.props.extensions }];
    }

    remote.dialog.showOpenDialog(options, async paths => {
      // Only change the file if a new file was selected
      if (!paths || paths.length === 0) {
        return;
      }

      const path = paths[0];
      this.props.onChange(path);
    });
  }

  render() {
    const { showFileName, showFileIcon, path, name, ...extraProps } = this.props;
    const fileName = pathBasename(path);
    return (
      <button
        type="button"
        ref={this._setRef}
        onClick={this._handleChooseFile}
        title={path}
        {...extraProps}>
        {showFileIcon && <i className="fa fa-file-o space-right" />}
        {showFileName && fileName ? `${fileName}` : `Choose ${name || 'File'}`}
      </button>
    );
  }
}

export default FileInputButton;
