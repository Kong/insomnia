import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import {basename as pathBasename} from 'path';
import {remote} from 'electron';

@autobind
class FileInputButton extends PureComponent {
  focus () {
    this._button.focus();
  }

  _setRef (n) {
    this._button = n;
  }

  _handleChooseFile () {
    const options = {
      title: 'Import File',
      buttonLabel: 'Import',
      properties: ['openFile']
    };

    remote.dialog.showOpenDialog(options, async paths => {
      if (!paths || paths.length === 0) {
        // Cancelling will clear the value
        this.props.onChange('');
      }

      const path = paths[0];
      this.props.onChange(path);
    });
  }

  render () {
    const {showFileName, path, name, ...extraProps} = this.props;
    const fileName = pathBasename(path);
    return (
      <button type="button" ref={this._setRef} onClick={this._handleChooseFile} {...extraProps}>
        {showFileName && fileName ? `${fileName}` : `Choose ${name || 'File'}`}
      </button>
    );
  }
}

FileInputButton.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,

  // Optional
  showFileName: PropTypes.bool,
  name: PropTypes.string
};

export default FileInputButton;
