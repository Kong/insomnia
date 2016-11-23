import React, {Component, PropTypes} from 'react';
import {basename as pathBasename} from 'path';
import {remote} from 'electron';

class FileInputButton extends Component {
  _handleChooseFile () {
    const options = {
      title: 'Import File',
      buttonLabel: 'Import',
      properties: ['openFile']
    };

    remote.dialog.showOpenDialog(options, async paths => {
      if (!paths || paths.length === 0) {
        return;
      }

      const path = paths[0];
      this.props.onChange(path);
    })
  }

  render () {
    const {showFileName, path, ...extraProps} = this.props;
    const fileName = pathBasename(path);
    return (
      <button onClick={e => this._handleChooseFile()} {...extraProps}>
        {showFileName && fileName ? `${fileName}`: 'Choose File'}
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
};

export default FileInputButton;
