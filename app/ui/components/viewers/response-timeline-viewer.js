import React, {PropTypes, PureComponent} from 'react';
import {shell} from 'electron';
import CodeEditor from '../codemirror/code-editor';

class ResponseTimelineViewer extends PureComponent {
  _handleClickLink (link) {
    shell.openExternal(link);
  }

  renderRow (row) {
    const {name, value} = row;

    let symbol = null;
    switch (name) {
      case 'HEADER_IN':
        symbol = '<';
        break;
      case 'DATA_IN':
        symbol = '';
        break;
      case 'SSL_DATA_IN':
        symbol = '<';
        break;
      case 'HEADER_OUT':
        symbol = '>';
        break;
      case 'DATA_OUT':
        symbol = '';
        break;
      case 'SSL_DATA_OUT':
        symbol = '>';
        break;
      case 'TEXT':
        symbol = '*';
        break;
    }

    if (symbol !== null) {
      const lines = (value + '').replace(/\n$/, '').split('\n');
      const newLines = lines
        .filter(l => !l.match(/^\s*$/))
        .map(l => symbol ? `${symbol} ${l}` : l);
      return newLines.join('\n');
    } else {
      return null;
    }
  }

  render () {
    const {timeline, editorFontSize, editorLineWrapping} = this.props;
    const rows = timeline.map(this.renderRow).filter(r => r !== null).join('\n');
    return (
      <CodeEditor
        hideLineNumbers
        readOnly
        onClickLink={this._handleClickLink}
        defaultValue={rows}
        fontSize={editorFontSize}
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
  editorLineWrapping: PropTypes.bool.isRequired
};

export default ResponseTimelineViewer;
