// @flow
import * as React from 'react';
import iconv from 'iconv-lite';
import autobind from 'autobind-decorator';
import { shell } from 'electron';
import PDFViewer from './response-pdf-viewer';
import CSVViewer from './response-csv-viewer';
import CodeEditor from '../codemirror/code-editor';
import ResponseWebView from './response-web-view';
import MultipartViewer from './response-multipart';
import ResponseRaw from './response-raw';
import ResponseError from './response-error';
import {
  HUGE_RESPONSE_MB,
  LARGE_RESPONSE_MB,
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_RAW
} from '../../../common/constants';
import Wrap from '../wrap';

let alwaysShowLargeResponses = false;

type Props = {
  getBody: Function,
  download: Function,
  responseId: string,
  previewMode: string,
  filter: string,
  filterHistory: Array<string>,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  url: string,
  bytes: number,
  contentType: string,

  // Optional
  updateFilter: Function | null,
  error: string | null
};

type State = {
  blockingBecauseTooLarge: boolean,
  bodyBuffer: Buffer | null,
  error: string
};

@autobind
class ResponseViewer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      blockingBecauseTooLarge: false,
      bodyBuffer: null,
      error: ''
    };
  }

  _decodeIconv(bodyBuffer: Buffer, charset: string): string {
    try {
      return iconv.decode(bodyBuffer, charset);
    } catch (err) {
      console.warn('[response] Failed to decode body', err);
      return bodyBuffer.toString();
    }
  }

  _handleOpenLink(link: string) {
    shell.openExternal(link);
  }

  _handleDismissBlocker() {
    this.setState({ blockingBecauseTooLarge: false });
    this._maybeLoadResponseBody(this.props, true);
  }

  _handleDisableBlocker() {
    alwaysShowLargeResponses = true;
    this._handleDismissBlocker();
  }

  _maybeLoadResponseBody(props: Props, forceShow?: boolean) {
    // Block the response if it's too large
    const responseIsTooLarge = props.bytes > LARGE_RESPONSE_MB * 1024 * 1024;
    if (!forceShow && !alwaysShowLargeResponses && responseIsTooLarge) {
      this.setState({ blockingBecauseTooLarge: true });
    } else {
      try {
        const bodyBuffer = props.getBody();
        this.setState({
          bodyBuffer,
          blockingBecauseTooLarge: false
        });
      } catch (err) {
        this.setState({
          error: `Failed reading response from filesystem: ${err.stack}`
        });
      }
    }
  }

  componentWillMount() {
    this._maybeLoadResponseBody(this.props);
  }

  componentWillReceiveProps(nextProps: Props) {
    this._maybeLoadResponseBody(nextProps);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    for (let k of Object.keys(nextProps)) {
      const next = nextProps[k];
      const current = this.props[k];

      if (typeof next === 'function') {
        continue;
      }

      if (current instanceof Buffer && next instanceof Buffer) {
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

      if (current instanceof Buffer && next instanceof Buffer) {
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

  render() {
    const {
      bytes,
      download,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      editorLineWrapping,
      error: responseError,
      filter,
      filterHistory,
      previewMode,
      responseId,
      updateFilter,
      url
    } = this.props;

    let contentType = this.props.contentType;

    const { bodyBuffer, error: parseError } = this.state;

    const error = responseError || parseError;

    if (error) {
      return (
        <div className="scrollable tall">
          <ResponseError url={url} error={error} fontSize={editorFontSize} />
        </div>
      );
    }

    const wayTooLarge = bytes > HUGE_RESPONSE_MB * 1024 * 1024;
    const { blockingBecauseTooLarge } = this.state;
    if (blockingBecauseTooLarge) {
      return (
        <div className="response-pane__notify">
          {wayTooLarge ? (
            <Wrap>
              <p className="pad faint">
                Responses over {HUGE_RESPONSE_MB}MB cannot be shown
              </p>
              <button
                onClick={download}
                className="inline-block btn btn--clicky">
                Save Response To File
              </button>
            </Wrap>
          ) : (
            <Wrap>
              <p className="pad faint">
                Response over {LARGE_RESPONSE_MB}MB hidden for performance
                reasons
              </p>
              <div>
                <button
                  onClick={download}
                  className="inline-block btn btn--clicky margin-xs">
                  Save To File
                </button>
                <button
                  onClick={this._handleDismissBlocker}
                  disabled={wayTooLarge}
                  className=" inline-block btn btn--clicky margin-xs">
                  Show Anyway
                </button>
              </div>
              <div className="pad-top-sm">
                <button
                  className="faint inline-block btn btn--super-compact"
                  onClick={this._handleDisableBlocker}>
                  Always Show
                </button>
              </div>
            </Wrap>
          )}
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
      return <div className="pad faint">No body returned for response</div>;
    }

    // Try to detect JSON in all cases (even if header is set). Apparently users
    // often send JSON with weird content-types like text/plain
    try {
      JSON.parse(bodyBuffer.toString('utf8'));
      contentType = 'application/json';
    } catch (e) {
      // Nothing
    }

    // Try to detect HTML in all cases (even if header is set). It is fairly
    // common for webservers to send errors in HTML by default.
    // NOTE: This will probably never throw but I'm not 100% so wrap anyway
    try {
      const isProbablyHTML = bodyBuffer
        .slice(0, 100)
        .toString()
        .trim()
        .match(/^<!doctype html.*>/i);
      if (contentType.indexOf('text/html') !== 0 && isProbablyHTML) {
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
            <img
              src={`data:${justContentType};base64,${base64Body}`}
              className="pad block"
              style={{ maxWidth: '100%', maxHeight: '100%', margin: 'auto' }}
            />
          </div>
        </div>
      );
    } else if (previewMode === PREVIEW_MODE_FRIENDLY && ct.includes('html')) {
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = match && match.length >= 2 ? match[1] : 'utf-8';
      return (
        <ResponseWebView
          body={this._decodeIconv(bodyBuffer, charset)}
          contentType={contentType}
          url={url}
        />
      );
    } else if (
      previewMode === PREVIEW_MODE_FRIENDLY &&
      ct.indexOf('application/pdf') === 0
    ) {
      return (
        <div className="tall wide scrollable">
          <PDFViewer body={bodyBuffer} uniqueKey={responseId} />
        </div>
      );
    } else if (
      previewMode === PREVIEW_MODE_FRIENDLY &&
      ct.indexOf('text/csv') === 0
    ) {
      return (
        <div className="tall wide scrollable">
          <CSVViewer body={bodyBuffer} key={responseId} />
        </div>
      );
    } else if (
      previewMode === PREVIEW_MODE_FRIENDLY &&
      ct.indexOf('multipart/') === 0
    ) {
      return (
        <MultipartViewer
          key={responseId}
          bodyBuffer={bodyBuffer}
          contentType={contentType}
          download={download}
          editorFontSize={editorFontSize}
          editorIndentSize={editorIndentSize}
          editorKeyMap={editorKeyMap}
          editorLineWrapping={editorLineWrapping}
          filter={filter}
          filterHistory={filterHistory}
          responseId={responseId}
          url={url}
        />
      );
    } else if (
      previewMode === PREVIEW_MODE_FRIENDLY &&
      ct.indexOf('audio/') === 0
    ) {
      const justContentType = contentType.split(';')[0];
      const base64Body = bodyBuffer.toString('base64');
      return (
        <div className="vertically-center" key={responseId}>
          <audio controls>
            <source src={`data:${justContentType};base64,${base64Body}`} />
          </audio>
        </div>
      );
    } else if (previewMode === PREVIEW_MODE_RAW) {
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = match && match.length >= 2 ? match[1] : 'utf-8';
      return (
        <ResponseRaw
          key={responseId}
          value={this._decodeIconv(bodyBuffer, charset)}
          fontSize={editorFontSize}
        />
      );
    } else {
      // Show everything else as "source"
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = match && match.length >= 2 ? match[1] : 'utf-8';

      // Sometimes iconv conversion fails so fallback to regular buffer
      const body = this._decodeIconv(bodyBuffer, charset);

      // Try to detect content-types if there isn't one
      let mode;
      if (!mode && body.match(/^\s*<\?xml [^?]*\?>/)) {
        mode = 'application/xml';
      } else {
        mode = contentType;
      }

      return (
        <CodeEditor
          uniquenessKey={responseId}
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

export default ResponseViewer;
