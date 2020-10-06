import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import CopyButton from '../base/copy-button';

@autobind
class ResponseRaw extends PureComponent {
  _setCodeEditorRef(n) {
    this._codeEditor = n;
  }

  shouldComponentUpdate(nextProps) {
    for (const key in nextProps) {
      if (nextProps.hasOwnProperty(key)) {
        if (nextProps[key] !== this.props[key]) {
          return true;
        }
      }
    }

    return false;
  }

  focus() {
    if (this._codeEditor) {
      this._codeEditor.focus();
    }
  }

  selectAll() {
    if (this._codeEditor) {
      this._codeEditor.selectAll();
    }
  }

  render() {
    const { fontSize, responseId, value } = this.props;
    return (
      <div className="tall">
        <CopyButton
          size="small"
          content={value}
          className="pull-right"
          title="Copy raw response"
          confirmMessage="">
          <i className="fa fa-copy" />
        </CopyButton>
        <CodeEditor
          ref={this._setCodeEditorRef}
          defaultValue={value}
          fontSize={fontSize}
          hideLineNumbers
          lineWrapping
          mode="text/plain"
          noMatchBrackets
          placeholder="..."
          raw
          readOnly
          uniquenessKey={responseId}
        />
      </div>
    );
  }
}

ResponseRaw.propTypes = {
  value: PropTypes.string.isRequired,
  fontSize: PropTypes.number,
  responseId: PropTypes.string,
};

export default ResponseRaw;
