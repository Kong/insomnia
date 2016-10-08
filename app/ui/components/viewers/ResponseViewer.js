import React, {Component, PropTypes} from 'react';
import Editor from '../base/Editor';
import ResponseWebview from './ResponseWebview';
import ResponseRaw from './ResponseRaw';
import ResponseError from './ResponseError';
import {
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_SOURCE
} from '../../../backend/previewModes';
import {LARGE_RESPONSE_MB} from '../../../backend/constants';

let alwaysShowLargeResponses = false;

class ResponseViewer extends Component {
  constructor (props) {
    super(props);
    this.state = {
      blockingBecauseTooLarge: false
    };
  };

  _handleDismissBlocker () {
    this.setState({blockingBecauseTooLarge: false});
  }

  _handleDisableBlocker () {
    alwaysShowLargeResponses = true;
    this._handleDismissBlocker();
  }

  _checkResponseBlocker (props) {
    if (alwaysShowLargeResponses) {
      return;
    }

    // Block the response if it's too large
    if (props.bytes > LARGE_RESPONSE_MB * 1024 * 1024) {
      this.setState({blockingBecauseTooLarge: true});
    }
  }

  componentWillMount () {
    this._checkResponseBlocker(this.props);
  }

  componentWillReceiveProps (nextProps) {
    this._checkResponseBlocker(nextProps);
  }

  shouldComponentUpdate (nextProps, nextState) {
    for (let k of Object.keys(nextProps)) {
      const value = nextProps[k];
      if (typeof value !== 'function' && this.props[k] !== value) {
        return true;
      }
    }

    for (let k of Object.keys(nextState)) {
      const value = nextState[k];
      if (typeof value !== 'function' && this.state[k] !== value) {
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
      return <ResponseError url={url} error={body}/>
    }

    const {blockingBecauseTooLarge} = this.state;
    if (blockingBecauseTooLarge) {
      return (
        <div className="response-pane__overlay response-pane__overlay--under">
          <p className="pad faint">
            Previewing responses over {LARGE_RESPONSE_MB}MB may cause
            slowdowns on some computers
          </p>
          <p>
            <button onClick={e => this._handleDismissBlocker()}
                    className="inline-block btn btn--super-compact btn--outlined">
              Show Response
            </button>
            {" "}
            <button className="faint inline-block btn btn--super-compact"
                    onClick={e => this._handleDisableBlocker()}>
              Always Show
            </button>
          </p>
        </div>
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
  bytes: PropTypes.number.isRequired,
  responseId: PropTypes.string.isRequired,

  // Optional
  updateFilter: PropTypes.func,
  contentType: PropTypes.string,
  error: PropTypes.bool
};

export default ResponseViewer;
