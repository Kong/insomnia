import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { shell } from 'electron';
import CodeEditor from '../codemirror/code-editor';

class ResponseTimelineViewer extends PureComponent {
  _handleClickLink(link) {
    shell.openExternal(link);
  }

  renderRow(row) {
    const { name, value } = row;

    let prefix = null;
    switch (name) {
      case 'HEADER_IN':
        prefix = '< ';
        break;
      case 'DATA_IN':
        prefix = '| ';
        break;
      case 'SSL_DATA_IN':
        prefix = '<< ';
        break;
      case 'HEADER_OUT':
        prefix = '> ';
        break;
      case 'DATA_OUT':
        prefix = '| ';
        break;
      case 'SSL_DATA_OUT':
        prefix = '>> ';
        break;
      case 'TEXT':
        prefix = '* ';
        break;
    }

    if (prefix !== null) {
      const lines = (value + '').replace(/\n$/, '').split('\n');
      const newLines = lines
        .filter(l => !l.match(/^\s*$/))
        .map(l => `${prefix}${l}`);
      return newLines.join('\n');
    } else {
      return null;
    }
  }

  render() {
    const {
      timeline,
      editorFontSize,
      editorIndentSize,
      editorLineWrapping
    } = this.props;
    const rows = timeline
      .map(this.renderRow)
      .filter(r => r !== null)
      .join('\n');
    return (
      <CodeEditor
        hideLineNumbers
        readOnly
        onClickLink={this._handleClickLink}
        defaultValue={rows}
        fontSize={editorFontSize}
        indentSize={editorIndentSize}
        lineWrapping={editorLineWrapping}
        className="pad-left"
        mode="curl"
      />
    );
  }
}

ResponseTimelineViewer.propTypes = {
  timeline: PropTypes.array.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired
};

export default ResponseTimelineViewer;
