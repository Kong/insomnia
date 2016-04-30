import React, {Component, PropTypes} from 'react'

import Editor from '../components/base/Editor'
import ResponseBodyWebview from '../components/ResponseBodyWebview'
import {PREVIEW_MODE_FRIENDLY, PREVIEW_MODE_SOURCE} from '../lib/previewModes'

class ResponseViewer extends Component {
  render () {
    const {previewMode, contentType, body} = this.props;

    switch (previewMode) {
      case PREVIEW_MODE_FRIENDLY:
        return (
          <div className="grid--v grid__cell bg-light">
            <ResponseBodyWebview
              body={body}
              contentType={contentType}
            />
          </div>
        );
      case PREVIEW_MODE_SOURCE:
        return (
          <div className="grid__cell editor-wrapper">
            <Editor
              value={body || ''}
              prettify={true}
              mode={contentType}
              readOnly={true}
              placeholder="nothing yet..."
            />
          </div>
        );
      default: // Raw
        return (
          <div className="grid__cell editor-wrapper">
            <Editor
              value={body || ''}
              lineWrapping={true}
              prettify={true}
              mode="text/plain"
              readOnly={true}
              placeholder="nothing yet..."
            />
          </div>
        )
    }
  }
}

ResponseViewer.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,
  previewMode: PropTypes.string.isRequired
};

export default ResponseViewer;
