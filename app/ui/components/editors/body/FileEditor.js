import fs from 'fs';
import electron from 'electron';
import React, {PropTypes, Component} from 'react';
import FileInputButton from '../../base/FileInputButton';
import PromptButton from '../../base/PromptButton';
import * as misc from '../../../../common/misc';
import {trackEvent} from '../../../../analytics/index';

class FileEditor extends Component {
  render () {
    const {path, onChange} = this.props;

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
      <div className="text-center pad">
        <p className="txt-sm pad-top">
          {path ? (
            <code className="wrap">
              <span className="force-wrap selectable" title={path}>
                {pathDescription}
              </span>
              {" "}
              <span className="no-wrap italic">({sizeDescription})</span>
            </code>
          ) : (
            <code className="super-faint">No file selected</code>
          )}
        </p>
        <div>
          <PromptButton className="btn btn--super-compact"
                        disabled={!path}
                        onClick={e => {
                          onChange('');
                          trackEvent('File Editor', 'Reset')
                        }}>
            Reset File
          </PromptButton>
          &nbsp;&nbsp;
          <FileInputButton
            path={path}
            className="btn btn--super-compact btn--outlined"
            onChange={path => {
              onChange(path);
              trackEvent('File Editor', 'Choose')
            }}
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
