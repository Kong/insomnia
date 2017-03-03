import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import fs from 'fs';
import electron from 'electron';
import FileInputButton from '../../base/FileInputButton';
import PromptButton from '../../base/PromptButton';
import * as misc from '../../../../common/misc';
import {trackEvent} from '../../../../analytics/index';

@autobind
class FileEditor extends PureComponent {
  constructor (props) {
    super(props);
  }

  _handleResetFile () {
    this.props.onChange('');
    trackEvent('File Editor', 'Reset');
  }

  _handleChooseFile (path) {
    this.props.onChange(path);
    trackEvent('File Editor', 'Choose');
  };

  render () {
    const {path} = this.props;

    // Replace home path with ~/ to make the path shorter
    const homeDirectory = electron.remote.app.getPath('home');
    const pathDescription = path.replace(homeDirectory, '~');

    let sizeDescription = '';
    try {
      const bytes = fs.statSync(path).size;
      sizeDescription = misc.describeByteSize(bytes);
    } catch (e) {
      sizeDescription = '';
    }

    return (
      <div className="text-center">
        <div className="pad text-left">
          <label className="label--small">Selected File</label>
          {path ? (
            <code className="block txt-sm">
              <span className="force-wrap selectable" title={path}>
                {pathDescription}
              </span>
              {" "}
              <span className="no-wrap">({sizeDescription})</span>
            </code>
          ) : (
            <code className="super-faint block txt-sm">
              No file selected
            </code>
          )}
        </div>
        <div>
          <PromptButton className="btn btn--super-compact"
                        disabled={!path}
                        onClick={this._handleResetFile}>
            Reset File
          </PromptButton>
          &nbsp;&nbsp;
          <FileInputButton
            path={path}
            className="btn btn--clicky"
            onChange={this._handleChooseFile}
          />
        </div>
      </div>
    )
  }
}

FileEditor.propTypes = {
  onChange: PropTypes.func.isRequired,
  path: PropTypes.string.isRequired,
};

export default FileEditor;
