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
    const options = {
      title: 'Import File',
      buttonLabel: 'Import',
      properties: ['openFile']
    };

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
    const {
      showFileName,
      showFileIcon,
      path,
      name,
      ...extraProps
    } = this.props;
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
