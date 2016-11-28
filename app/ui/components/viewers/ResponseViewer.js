import React, {Component, PropTypes} from 'react';
import Editor from '../base/Editor';
import ResponseWebView from './ResponseWebview';
import ResponseRaw from './ResponseRaw';
import ResponseError from './ResponseError';
import {LARGE_RESPONSE_MB, PREVIEW_MODE_FRIENDLY, PREVIEW_MODE_SOURCE} from '../../../common/constants';

let alwaysShowLargeResponses = false;

class ResponseViewer extends Component {
  state = {
    blockingBecauseTooLarge: false
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
      statusCode,
      body: base64Body,
      encoding,
      url,
      error
    } = this.props;

    const bodyBuffer = new Buffer(base64Body, encoding);

    if (error) {
      return (
        <ResponseError
          url={url}
          error={bodyBuffer.toString('utf8')}
          statusCode={statusCode}
        />
      )
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
                    className="inline-block btn btn--clicky">
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
        if (contentType.toLowerCase().indexOf('image/') === 0) {
          const justContentType = contentType.split(';')[0];
          return (
            <div className="scrollable-container tall wide">
              <div className="scrollable">
                <img src={`data:${justContentType};base64,${base64Body}`}
                     className="pad block"
                     style={{
                       maxWidth: '100%',
                       maxHeight: '100%',
                       margin: 'auto',
                     }}/>
              </div>
            </div>
          )
        } else {
          return (
            <ResponseWebView
              body={bodyBuffer.toString('utf8')}
              contentType={contentType}
              url={url}
            />
          );
        }
      case PREVIEW_MODE_SOURCE:
        let mode = contentType;
        const body = bodyBuffer.toString('utf8');

        try {
          // FEATURE: Detect JSON even without content-type
          contentType.indexOf('json') === -1 && JSON.parse(body);
          mode = 'application/json';
        } catch (e) {
          // Nothing
        }

        return (
          <Editor
            value={body}
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
          <ResponseRaw
            value={bodyBuffer.toString('utf8')}
            fontSize={editorFontSize}
          />
        )
    }
  }
}

ResponseViewer.propTypes = {
  body: PropTypes.string.isRequired,
  encoding: PropTypes.string.isRequired,
  previewMode: PropTypes.string.isRequired,
  filter: PropTypes.string.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  url: PropTypes.string.isRequired,
  bytes: PropTypes.number.isRequired,
  statusCode: PropTypes.number.isRequired,
  responseId: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,

  // Optional
  updateFilter: PropTypes.func,
  error: PropTypes.bool
};

export default ResponseViewer;
