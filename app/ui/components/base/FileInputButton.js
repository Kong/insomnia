import React, {Component, PropTypes} from 'react';
import {remote} from 'electron';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import PromptButton from '../base/PromptButton';

class FileInputButton extends Component {
  _handleUnsetFile () {
    this.props.onChange('');
  }

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
    const {className} = this.props;
    return (
      <Dropdown>
        <DropdownButton className={className}>
          Choose File <i className="fa fa-caret-down"></i>
        </DropdownButton>
        <DropdownItem onClick={e => this._handleChooseFile()}>
          <i className="fa fa-file"></i>
          Choose File
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton}
                      addIcon={true}
                      onClick={e => this._handleUnsetFile()}>
          <i className="fa fa-close"></i>
          Clear File
        </DropdownItem>
      </Dropdown>
    )
  }
}

FileInputButton.propTypes = {
  onChange: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,
};

export default FileInputButton;
