import React, {Component, PropTypes} from 'react';
import Editor from '../base/Editor';
import ResponseWebview from './ResponseWebview';
import ResponseError from './ResponseError';
import {
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_SOURCE
} from '../../lib/previewModes';

class ResponseViewer extends Component {
  shouldComponentUpdate (nextProps) {
    for (let k of Object.keys(nextProps)) {
      if (this.props[k] !== nextProps[k]) {
        return true;
      }
    }

    return false;
  }

  render () {
    const {
      previewMode,
      contentType,
      editorLineWrapping,
      editorFontSize,
      body,
      url,
      error
    } = this.props;

    if (error) {
      return (
        <ResponseError
          url={url}
          error={body}
        />
      )
    }

    switch (previewMode) {
      case PREVIEW_MODE_FRIENDLY:
        return (
          <ResponseWebview
            body={body}
            contentType={contentType}
            url={url}
          />
        );
      case PREVIEW_MODE_SOURCE:
        return (
          <Editor
            value={body || ''}
            showFilter={true}
            prettify={true}
            mode={contentType}
            readOnly={true}
            lineWrapping={editorLineWrapping}
            fontSize={editorFontSize}
            placeholder="..."
          />
        );
      default: // Raw
        return (
          <pre className="scrollable wide tall selectable monospace pad"
               style={{fontSize: editorFontSize}}>
            {body}
          </pre>
        )
    }
  }
}

ResponseViewer.propTypes = {
  body: PropTypes.string.isRequired,
  previewMode: PropTypes.string.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  url: PropTypes.string.isRequired,

  // Optional
  contentType: PropTypes.string,
  error: PropTypes.bool
};

export default ResponseViewer;
