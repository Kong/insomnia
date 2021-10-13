import { autoBindMethodsForReact } from 'class-autobind-decorator';
import iconv from 'iconv-lite';
import React, { Component, Fragment } from 'react';

import {
  AUTOBIND_CFG,
  HUGE_RESPONSE_MB,
  LARGE_RESPONSE_MB,
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_RAW,
} from '../../../common/constants';
import { clickLink } from '../../../common/electron-helpers';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { xmlDecode } from '../../../common/misc';
import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';
import { KeydownBinder } from '../keydown-binder';
import { ResponseCSVViewer } from './response-csv-viewer';
import { ResponseErrorViewer } from './response-error-viewer';
import { ResponseMultipartViewer } from './response-multipart-viewer';
import { ResponsePDFViewer } from './response-pdf-viewer';
import { ResponseRawViewer } from './response-raw-viewer';
import { ResponseWebView } from './response-web-view';

let alwaysShowLargeResponses = false;

interface Props {
  bytes: number;
  contentType: string;
  disableHtmlPreviewJs: boolean;
  disablePreviewLinks: boolean;
  download: (...args: any[]) => any;
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
  editorLineWrapping: boolean;
  filter: string;
  filterHistory: string[];
  getBody: (...args: any[]) => any;
  previewMode: string;
  responseId: string;
  url: string;
  updateFilter?: (filter: string) => void;
  error?: string | null;
}

interface State {
  blockingBecauseTooLarge: boolean;
  bodyBuffer: Buffer | null;
  error: string;
  hugeResponse: boolean;
  largeResponse: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseViewer extends Component<Props, State> {
  _selectableView: ResponseRawViewer | UnconnectedCodeEditor | null;

  state: State = {
    blockingBecauseTooLarge: false,
    bodyBuffer: null,
    error: '',
    hugeResponse: false,
    largeResponse: false,
  };

  refresh() {
    // @ts-expect-error -- TSCONVERSION refresh only exists on a code-editor, not response-raw
    if (this._selectableView != null && typeof this._selectableView.refresh === 'function') {
      // @ts-expect-error -- TSCONVERSION refresh only exists on a code-editor, not response-raw
      this._selectableView.refresh();
    }
  }

  _handleDismissBlocker() {
    this.setState({
      blockingBecauseTooLarge: false,
    });

    this._maybeLoadResponseBody(this.props, true);
  }

  _handleDisableBlocker() {
    alwaysShowLargeResponses = true;

    this._handleDismissBlocker();
  }

  _maybeLoadResponseBody(props: Props, forceShow?: boolean) {
    const { bytes } = props;
    const largeResponse = bytes > LARGE_RESPONSE_MB * 1024 * 1024;
    const hugeResponse = bytes > HUGE_RESPONSE_MB * 1024 * 1024;

    this.setState({ largeResponse, hugeResponse });

    // Block the response if it's too large
    if (!forceShow && !alwaysShowLargeResponses && largeResponse) {
      this.setState({ blockingBecauseTooLarge: true });
    } else {
      try {
        const bodyBuffer = props.getBody();
        this.setState({
          bodyBuffer,
          blockingBecauseTooLarge: false,
        });
      } catch (err) {
        this.setState({
          error: `Failed reading response from filesystem: ${err.stack}`,
        });
      }
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillMount() {
    this._maybeLoadResponseBody(this.props);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    this._maybeLoadResponseBody(nextProps);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    for (const k of Object.keys(nextProps)) {
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

    for (const k of Object.keys(nextState)) {
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

  _setSelectableViewRef<T extends ResponseRawViewer | UnconnectedCodeEditor | null>(n: T) {
    this._selectableView = n;
  }

  _isViewSelectable() {
    return (
      this._selectableView != null &&
      typeof this._selectableView.focus === 'function' &&
      typeof this._selectableView.selectAll === 'function'
    );
  }

  _handleKeyDown(e: KeyboardEvent) {
    if (!this._isViewSelectable()) {
      return;
    }

    executeHotKey(e, hotKeyRefs.RESPONSE_FOCUS, () => {
      if (!this._isViewSelectable()) {
        return;
      }

      this._selectableView?.focus();

      if (!this.state.largeResponse) {
        this._selectableView?.selectAll();
      }
    });
  }

  _getBody() {
    const { bodyBuffer } = this.state;
    const { contentType } = this.props;

    if (!bodyBuffer) {
      return '';
    }

    // Show everything else as "source"
    const match = contentType.match(/charset=([\w-]+)/);
    const charset = match && match.length >= 2 ? match[1] : 'utf-8';

    try {
      return iconv.decode(bodyBuffer, charset);
    } catch (err) {
      console.warn('[response] Failed to decode body', err);
      // Sometimes iconv conversion fails so fallback to regular buffer
      return bodyBuffer.toString();
    }
  }

  /** Try to detect content-types if there isn't one */
  _getMode() {
    const { contentType } = this.props;
    const body = this._getBody();
    if (body?.match(/^\s*<\?xml [^?]*\?>/)) {
      return 'application/xml';
    } else {
      return contentType;
    }
  }

  _handleClickLink(url: string) {
    const mode = this._getMode();

    if (mode === 'application/xml') {
      clickLink(xmlDecode(url));
      return;
    }

    clickLink(url);
  }

  _renderView() {
    const {
      disableHtmlPreviewJs,
      disablePreviewLinks,
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
      url,
    } = this.props;
    // WARNING: props should never be overwritten!
    let { contentType } = this.props;
    const { bodyBuffer, error: parseError } = this.state;
    const error = responseError || parseError;

    if (error) {
      return (
        <div className="scrollable tall">
          <ResponseErrorViewer url={url} error={error} fontSize={editorFontSize} />
        </div>
      );
    }

    const { blockingBecauseTooLarge, hugeResponse } = this.state;

    if (blockingBecauseTooLarge) {
      return (
        <div className="response-pane__notify">
          {hugeResponse ? (
            <Fragment>
              <p className="pad faint">Responses over {HUGE_RESPONSE_MB}MB cannot be shown</p>
              <button onClick={download} className="inline-block btn btn--clicky">
                Save Response To File
              </button>
            </Fragment>
          ) : (
            <Fragment>
              <p className="pad faint">
                Response over {LARGE_RESPONSE_MB}MB hidden for performance reasons
              </p>
              <div>
                <button onClick={download} className="inline-block btn btn--clicky margin-xs">
                  Save To File
                </button>
                <button
                  onClick={this._handleDismissBlocker}
                  disabled={hugeResponse}
                  className=" inline-block btn btn--clicky margin-xs"
                >
                  Show Anyway
                </button>
              </div>
              <div className="pad-top-sm">
                <button
                  className="faint inline-block btn btn--super-compact"
                  onClick={this._handleDisableBlocker}
                >
                  Always Show
                </button>
              </div>
            </Fragment>
          )}
        </div>
      );
    }

    if (!bodyBuffer) {
      return <div className="pad faint">Failed to read response body from filesystem</div>;
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
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                margin: 'auto',
              }}
            />
          </div>
        </div>
      );
    }

    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.includes('html')) {
      return (
        <ResponseWebView
          body={this._getBody()}
          contentType={contentType}
          key={disableHtmlPreviewJs ? 'no-js' : 'yes-js'}
          url={url}
          webpreferences={disableHtmlPreviewJs ? 'javascript=no' : 'javascript=yes'}
        />
      );
    }

    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('application/pdf') === 0) {
      return (
        <div className="tall wide scrollable">
          <ResponsePDFViewer body={bodyBuffer} uniqueKey={responseId} />
        </div>
      );
    }

    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('text/csv') === 0) {
      return (
        <div className="tall wide scrollable">
          <ResponseCSVViewer body={bodyBuffer} key={responseId} />
        </div>
      );
    }

    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('multipart/') === 0) {
      return (
        <ResponseMultipartViewer
          bodyBuffer={bodyBuffer}
          contentType={contentType}
          disableHtmlPreviewJs={disableHtmlPreviewJs}
          disablePreviewLinks={disablePreviewLinks}
          download={download}
          editorFontSize={editorFontSize}
          editorIndentSize={editorIndentSize}
          editorKeyMap={editorKeyMap}
          editorLineWrapping={editorLineWrapping}
          filter={filter}
          filterHistory={filterHistory}
          key={responseId}
          responseId={responseId}
          url={url}
        />
      );
    }

    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('audio/') === 0) {
      const justContentType = contentType.split(';')[0];
      const base64Body = bodyBuffer.toString('base64');
      return (
        <div className="vertically-center" key={responseId}>
          <audio controls>
            <source src={`data:${justContentType};base64,${base64Body}`} />
          </audio>
        </div>
      );
    }

    if (previewMode === PREVIEW_MODE_RAW) {
      return (
        <ResponseRawViewer
          key={responseId}
          responseId={responseId}
          ref={this._setSelectableViewRef}
          value={this._getBody()}
          fontSize={editorFontSize}
        />
      );
    }

    // Show everything else as "source"
    return (
      <CodeEditor
        key={disablePreviewLinks ? 'links-disabled' : 'links-enabled'}
        ref={this._setSelectableViewRef}
        autoPrettify
        defaultValue={this._getBody()}
        filter={filter}
        filterHistory={filterHistory}
        fontSize={editorFontSize}
        indentSize={editorIndentSize}
        keyMap={editorKeyMap}
        lineWrapping={editorLineWrapping}
        mode={this._getMode()}
        noMatchBrackets
        onClickLink={disablePreviewLinks ? undefined : this._handleClickLink}
        placeholder="..."
        readOnly
        uniquenessKey={responseId}
        updateFilter={updateFilter}
      />
    );
  }

  render() {
    return <KeydownBinder onKeydown={this._handleKeyDown}>{this._renderView()}</KeydownBinder>;
  }
}
