import React, {Component, PropTypes} from 'react';
import Editor from '../base/Editor';
import ResponseWebview from './ResponseWebview';
import ResponseRaw from './ResponseRaw';
import ResponseError from './ResponseError';
import {
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_SOURCE
} from 'backend/previewModes';

class ResponseViewer extends Component {
  shouldComponentUpdate (nextProps) {
    for (let k of Object.keys(nextProps)) {
      const prop = nextProps[k];
      if (typeof prop !== 'function' && this.props[k] !== prop) {
        return true;
      }
    }

    return false;
  }

  render () {
    const {
      previewMode,
      filter,
      contentType,
      editorLineWrapping,
      editorFontSize,
      updateFilter,
      body,
      url,
      error
    } = this.props;

    if (error) {
      return (
        <ResponseError url={url} error={body}/>
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
        let mode = contentType;

        try {
          // FEATURE: Detect JSON even without content-type
          contentType.indexOf('json') === -1 && JSON.parse(body);
          mode = 'application/json';
        } catch (e) {
          // Nothing
        }

        return (
          <Editor
            value={body || ''}
            updateFilter={updateFilter}
            filter={filter}
            autoPrettify={true}
            mode={mode}
            readOnly={true}
            lineWrapping={editorLineWrapping}
            fontSize={editorFontSize}
            placeholder="..."
          />
        );
      default: // Raw
        return (
          <ResponseRaw value={body} fontSize={editorFontSize}/>
        )
    }
  }
}

ResponseViewer.propTypes = {
  body: PropTypes.string.isRequired,
  previewMode: PropTypes.string.isRequired,
  filter: PropTypes.string.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  url: PropTypes.string.isRequired,

  // Optional
  updateFilter: PropTypes.func,
  contentType: PropTypes.string,
  error: PropTypes.bool
};

export default ResponseViewer;
