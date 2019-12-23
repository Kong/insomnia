// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { basename as pathBasename } from 'path';
import chooseFile from './choose-file';

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
    const path = await chooseFile({
      extensions: this.props.extensions,
      itemtypes: this.props.itemtypes,
    });
    if (path !== this.props.path) this.props.onChange(path);
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
