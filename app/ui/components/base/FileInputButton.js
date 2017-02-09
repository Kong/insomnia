import React, {Component, PropTypes} from 'react';
import {basename as pathBasename} from 'path';
import {remote} from 'electron';

class FileInputButton extends Component {
  _handleChooseFile = () => {
    const options = {
      title: 'Import File',
      buttonLabel: 'Import',
      properties: ['openFile']
    };

    remote.dialog.showOpenDialog(options, async paths => {
      if (!paths || paths.length === 0) {
        // Cancelling will clear the value
        this.props.onChange('');
      } else {
        this.props.onChange(paths[0]);
      }
    })
  };

  render () {
    const {showFileName, path, name, ...extraProps} = this.props;
    const fileName = pathBasename(path);
    return (
      <button type="button" onClick={this._handleChooseFile} {...extraProps}>
        {showFileName && fileName ? `${fileName}`: `Choose ${name || 'File'}`}
      </button>
    )
  }
}

FileInputButton.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,

  // Optional
  showFileName: PropTypes.bool,
  name: PropTypes.string,
};

export default FileInputButton;
