import React, {PropTypes, PureComponent} from 'react';
import CodeEditor from '../codemirror/code-editor';

class ResponseTimelineViewer extends PureComponent {
  renderRow (row) {
    const {name, value} = row;

    let symbol = null;
    switch (name) {
      case 'HEADER_IN':
        symbol = '<';
        break;
      case 'HEADER_OUT':
        symbol = '>';
        break;
      case 'TEXT':
        symbol = '*';
        break;
      // Don't show these (too much data)
      // case 'DATA_IN':
      // case 'DATA_OUT':
    }

    if (symbol) {
      const lines = value.replace(/\n$/, '').split('\n');
      const newLines = lines.filter(l => !l.match(/^\s*$/)).map(l => `${symbol} ${l}`);
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
