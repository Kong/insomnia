import * as React from 'react';
import PropTypes from 'prop-types';
import iconv from 'iconv-lite';
import autobind from 'autobind-decorator';
import {shell} from 'electron';
import {SimplePDF} from 'simple-react-pdf';
import CodeEditor from '../codemirror/code-editor';
import ResponseWebView from './response-webview';
import ResponseRaw from './response-raw';
import ResponseError from './response-error';
import {LARGE_RESPONSE_MB, PREVIEW_MODE_FRIENDLY, PREVIEW_MODE_RAW} from '../../../common/constants';

let alwaysShowLargeResponses = false;

@autobind
class ResponseViewer extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      blockingBecauseTooLarge: false,
      bodyBuffer: null
    };
  }

  _handleOpenLink (link) {
    shell.openExternal(link);
  }

  _handleDismissBlocker () {
    this.setState({blockingBecauseTooLarge: false});
    this._maybeLoadResponseBody(this.props, true);
  }

  _handleDisableBlocker () {
    alwaysShowLargeResponses = true;
    this._handleDismissBlocker();
  }

  _maybeLoadResponseBody (props, forceShow = false) {
    // Block the response if it's too large
    const responseIsTooLarge = props.bytes > LARGE_RESPONSE_MB * 1024 * 1024;
    if (!forceShow && !alwaysShowLargeResponses && responseIsTooLarge) {
      this.setState({blockingBecauseTooLarge: true});
    } else {
      this.setState({
        blockingBecauseTooLarge: false,
        bodyBuffer: props.getBody()
      });
    }
  }

  componentWillMount () {
    this._maybeLoadResponseBody(this.props);
  }

  componentWillReceiveProps (nextProps) {
    this._maybeLoadResponseBody(nextProps);
  }

  shouldComponentUpdate (nextProps, nextState) {
    for (let k of Object.keys(nextProps)) {
      const next = nextProps[k];
      const current = this.props[k];

      if (typeof next === 'function') {
        continue;
      }

      if (current instanceof Buffer) {
        if (current.equals(next)) {
          continue;
        } else {
          return true;
        }
      }

      if (next !== current) {
        return true;
      }
    }

    for (let k of Object.keys(nextState)) {
      const next = nextState[k];
      const current = this.state[k];

      if (typeof next === 'function') {
        continue;
      }

      if (current instanceof Buffer) {
        if (current.equals(next)) {
          continue;
        } else {
          return true;
        }
      }

      if (next !== current) {
        return true;
      }
    }

    return false;
  }

  render () {
    const {
      previewMode,
      filter,
      filterHistory,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      updateFilter,
      url,
      error
    } = this.props;

    let contentType = this.props.contentType;

    const {bodyBuffer} = this.state;

    if (error) {
      return (
        <ResponseError
          url={url}
          error={error}
          fontSize={editorFontSize}
        />
      );
    }

    const {blockingBecauseTooLarge} = this.state;
    if (blockingBecauseTooLarge) {
      return (
        <div className="response-pane__notify">
          <p className="pad faint">
            Response body over {LARGE_RESPONSE_MB}MB hidden to prevent unresponsiveness
          </p>
          <p>
            <button onClick={this._handleDismissBlocker}
                    className="inline-block btn btn--clicky">
              Show Response
            </button>
            {' '}
            <button className="faint inline-block btn btn--super-compact"
                    onClick={this._handleDisableBlocker}>
              Always Show
            </button>
          </p>
        </div>
      );
    }

    if (!bodyBuffer) {
      return (
        <div className="pad faint">
          Failed to read response body from filesystem
        </div>
      );
    }

    if (bodyBuffer.length === 0) {
      return (
        <div className="pad faint">
          No body returned for response
        </div>
      );
    }

    // Try to detect JSON in all cases (even if header is set). Apparently users
    // often send JSON with weird content-types like text/plain
    try {
      JSON.parse(bodyBuffer);
      contentType = 'application/json';
    } catch (e) {
      // Nothing
    }

    // Try to detect HTML in all cases (even if header is set). It is fairly
    // common for webservers to send errors in HTML by default.
    // NOTE: This will probably never throw but I'm not 100% so wrap anyway
    try {
      if (bodyBuffer.slice(0, 100).toString().trim().match(/^<!doctype html.*>/i)) {
        contentType = 'text/html';
      }
    } catch (e) {
      // Nothing
    }

    const ct = contentType.toLowerCase();
    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('image/') === 0) {
      const justContentType = contentType.split(';')[0];
      const base64Body = bodyBuffer.toString('base64');
      return (
        <div className="scrollable-container tall wide">
          <div className="scrollable">
            <img src={`data:${justContentType};base64,${base64Body}`}
                 className="pad block"
                 style={{maxWidth: '100%', maxHeight: '100%', margin: 'auto'}}/>
          </div>
        </div>
      );
    } else if (previewMode === PREVIEW_MODE_FRIENDLY && ct.includes('html')) {
      const justContentType = contentType.split(';')[0];
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = (match && match.length >= 2) ? match[1] : 'utf-8';
      return (
        <ResponseWebView
          body={iconv.decode(bodyBuffer, charset)}
          contentType={`${justContentType}; charset=UTF-8`}
          url={url}
        />
      );
    } else if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('application/pdf') === 0) {
      const justContentType = contentType.split(';')[0];
      const base64Body = bodyBuffer.toString('base64');
      return (
        <div className="tall wide scrollable">
          <SimplePDF file={`data:${justContentType};base64,${base64Body}`}/>
        </div>
      );
    } else if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('audio/') === 0) {
      const justContentType = contentType.split(';')[0];
      const base64Body = bodyBuffer.toString('base64');
      return (
        <div className="vertically-center">
          <audio controls>
            <source src={`data:${justContentType};base64,${base64Body}`}/>
          </audio>
        </div>
      );
    } else if (previewMode === PREVIEW_MODE_RAW) {
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = (match && match.length >= 2) ? match[1] : 'utf-8';
      return (
        <ResponseRaw
          value={iconv.decode(bodyBuffer, charset)}
          fontSize={editorFontSize}
        />
      );
    } else { // Show everything else as "source"
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = (match && match.length >= 2) ? match[1] : 'utf-8';
      const body = iconv.decode(bodyBuffer, charset);

      // Try to detect content-types if there isn't one
      let mode;
      if (!mode && body.match(/^\s*<\?xml [^?]*\?>/)) {
        mode = 'application/xml';
      } else {
        mode = contentType;
      }

      return (
        <CodeEditor
          onClickLink={this._handleOpenLink}
          defaultValue={body}
          updateFilter={updateFilter}
          filter={filter}
          filterHistory={filterHistory}
          autoPrettify
          noMatchBrackets
          readOnly
          mode={mode}
          lineWrapping={editorLineWrapping}
          fontSize={editorFontSize}
          indentSize={editorIndentSize}
          keyMap={editorKeyMap}
          placeholder="..."
        />
      );
    }
  }
}

ResponseViewer.propTypes = {
  getBody: PropTypes.func.isRequired,
  previewMode: PropTypes.string.isRequired,
  filter: PropTypes.string.isRequired,
  filterHistory: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  url: PropTypes.string.isRequired,
  bytes: PropTypes.number.isRequired,
  contentType: PropTypes.string.isRequired,

  // Optional
  updateFilter: PropTypes.func,
  error: PropTypes.string
};

export default ResponseViewer;
