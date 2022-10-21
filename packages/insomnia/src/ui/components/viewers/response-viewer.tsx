import iconv from 'iconv-lite';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  HUGE_RESPONSE_MB,
  LARGE_RESPONSE_MB,
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_RAW,
} from '../../../common/constants';
import { clickLink } from '../../../common/electron-helpers';
import { xmlDecode } from '../../../common/misc';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { ResponseCSVViewer } from './response-csv-viewer';
import { ResponseErrorViewer } from './response-error-viewer';
import { ResponseMultipartViewer } from './response-multipart-viewer';
import { ResponsePDFViewer } from './response-pdf-viewer';
import { ResponseRawViewer } from './response-raw-viewer';
import { ResponseWebView } from './response-web-view';

let alwaysShowLargeResponses = false;

export interface ResponseViewerHandle {
  refresh: () => void;
}

export interface ResponseViewerProps {
  bytes: number;
  contentType: string;
  disableHtmlPreviewJs: boolean;
  disablePreviewLinks: boolean;
  download: (...args: any[]) => any;
  editorFontSize: number;
  filter: string;
  filterHistory: string[];
  getBody: (...args: any[]) => any;
  previewMode: string;
  responseId: string;
  url: string;
  updateFilter?: (filter: string) => void;
  error?: string | null;
}

export const ResponseViewer = ({
  bytes,
  getBody,
  contentType: originalContentType,
  disableHtmlPreviewJs,
  disablePreviewLinks,
  download,
  editorFontSize,
  error: responseError,
  filter,
  filterHistory,
  previewMode,
  responseId,
  updateFilter,
  url,
}: ResponseViewerProps) => {
  const [largeResponse, setLargeResponse] = useState(false);
  const [blockingBecauseTooLarge, setBlockingBecauseTooLarge] = useState(false);
  const [bodyBuffer, setBodyBuffer] = useState<Buffer | null>(null);
  const [parseError, setError] = useState('');
  const [hugeResponse, setHugeResponse] = useState(false);

  const error = responseError || parseError;

  const _selectableViewRef = useRef<CodeEditorHandle | null>(null);

  function _handleDismissBlocker() {
    setBlockingBecauseTooLarge(false);

    _maybeLoadResponseBody(true);
  }

  function _handleDisableBlocker() {
    alwaysShowLargeResponses = true;

    _handleDismissBlocker();
  }

  const _maybeLoadResponseBody = useCallback(
    (forceShow?: boolean) => {
      const largeResponse = bytes > LARGE_RESPONSE_MB * 1024 * 1024;
      const hugeResponse = bytes > HUGE_RESPONSE_MB * 1024 * 1024;

      setLargeResponse(largeResponse);
      setHugeResponse(hugeResponse);

      // Block the response if it's too large
      if (!forceShow && !alwaysShowLargeResponses && largeResponse) {
        setBlockingBecauseTooLarge(true);
      } else {
        try {
          const bodyBuffer = getBody();
          setBodyBuffer(bodyBuffer);
          setBlockingBecauseTooLarge(false);
        } catch (err) {
          setError(`Failed reading response from filesystem: ${err.stack}`);
        }
      }
    },
    [bytes, getBody]
  );

  useEffect(() => {
    _maybeLoadResponseBody();
  }, [_maybeLoadResponseBody]);

  const _isViewSelectable = () => {
    return (
      _selectableViewRef.current != null &&
      'focus' in _selectableViewRef.current &&
      typeof _selectableViewRef.current.focus === 'function' &&
      typeof _selectableViewRef.current.selectAll === 'function'
    );
  };

  useDocBodyKeyboardShortcuts({
    response_focus: () => {
      if (!_isViewSelectable()) {
        return;
      }

      if (_selectableViewRef.current) {
        if ('focus' in _selectableViewRef.current) {
          _selectableViewRef.current.focus();
        }

        if (!largeResponse && 'selectAll' in _selectableViewRef.current) {
          _selectableViewRef.current.selectAll();
        }
      }
    },
  });

  function _getContentType() {
    const lowercasedOriginalContentType = originalContentType.toLowerCase();

    if (!bodyBuffer || bodyBuffer.length === 0) {
      return lowercasedOriginalContentType;
    }

    // Try to detect JSON in all cases (even if a different header is set).
    // Apparently users often send JSON with weird content-types like text/plain.
    try {
      if (bodyBuffer && bodyBuffer.length > 0) {
        JSON.parse(bodyBuffer.toString('utf8'));
        return 'application/json';
      }
    } catch (error) {
      // Nothing
    }

    // Try to detect HTML in all cases (even if header is set).
    // It is fairly common for webservers to send errors in HTML by default.
    // NOTE: This will probably never throw but I'm not 100% so wrap anyway
    try {
      const isProbablyHTML = bodyBuffer
        .slice(0, 100)
        .toString()
        .trim()
        .match(/^<!doctype html.*>/i);

      if (
        lowercasedOriginalContentType.indexOf('text/html') !== 0 &&
        isProbablyHTML
      ) {
        return 'text/html';
      }
    } catch (error) {
      // Nothing
    }

    return lowercasedOriginalContentType;
  }

  function _getBody() {
    if (!bodyBuffer) {
      return '';
    }

    // Show everything else as "source"
    const contentType = _getContentType();
    const match = contentType.match(/charset=([\w-]+)/);
    const charset = match && match.length >= 2 ? match[1] : 'utf-8';

    // Sometimes iconv conversion fails so fallback to regular buffer
    try {
      return iconv.decode(bodyBuffer, charset);
    } catch (err) {
      console.warn('[response] Failed to decode body', err);
      return bodyBuffer.toString();
    }
  }

  /** Try to detect content-types if there isn't one */
  function _getMode() {
    if (_getBody()?.match(/^\s*<\?xml [^?]*\?>/)) {
      return 'application/xml';
    }

    return _getContentType();
  }

  function _handleClickLink(url: string) {
    const mode = _getMode();

    if (mode === 'application/xml') {
      clickLink(xmlDecode(url));
      return;
    }

    clickLink(url);
  }

  if (error) {
    return (
      <div className="scrollable tall">
        <ResponseErrorViewer url={url} error={error} />
      </div>
    );
  }

  if (blockingBecauseTooLarge) {
    return (
      <div className="response-pane__notify">
        {hugeResponse ? (
          <Fragment>
            <p className="pad faint">
              Responses over {HUGE_RESPONSE_MB}MB cannot be shown
            </p>
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
              <button
                onClick={download}
                className="inline-block btn btn--clicky margin-xs"
              >
                Save To File
              </button>
              <button
                onClick={_handleDismissBlocker}
                disabled={hugeResponse}
                className=" inline-block btn btn--clicky margin-xs"
              >
                Show Anyway
              </button>
            </div>
            <div className="pad-top-sm">
              <button
                className="faint inline-block btn btn--super-compact"
                onClick={_handleDisableBlocker}
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
    return (
      <div className="pad faint">
        Failed to read response body from filesystem
      </div>
    );
  }

  if (bodyBuffer.length === 0) {
    return <div className="pad faint">No body returned for response</div>;
  }

  const contentType = _getContentType();
  if (
    previewMode === PREVIEW_MODE_FRIENDLY &&
      contentType.indexOf('image/') === 0
  ) {
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

  if (previewMode === PREVIEW_MODE_FRIENDLY && contentType.includes('html')) {
    return (
      <ResponseWebView
        body={_getBody()}
        contentType={contentType}
        key={disableHtmlPreviewJs ? 'no-js' : 'yes-js'}
        url={url}
        webpreferences={`disableDialogs=true, javascript=${
          disableHtmlPreviewJs ? 'no' : 'yes'
        }`}
      />
    );
  }

  if (
    previewMode === PREVIEW_MODE_FRIENDLY &&
      contentType.indexOf('application/pdf') === 0
  ) {
    return (
      <div className="tall wide scrollable">
        <ResponsePDFViewer body={bodyBuffer} key={responseId} />
      </div>
    );
  }

  if (
    previewMode === PREVIEW_MODE_FRIENDLY &&
      contentType.indexOf('text/csv') === 0
  ) {
    return (
      <div className="tall wide scrollable">
        <ResponseCSVViewer body={bodyBuffer} key={responseId} />
      </div>
    );
  }

  if (
    previewMode === PREVIEW_MODE_FRIENDLY &&
      contentType.indexOf('multipart/') === 0
  ) {
    return (
      <ResponseMultipartViewer
        bodyBuffer={bodyBuffer}
        contentType={contentType}
        disableHtmlPreviewJs={disableHtmlPreviewJs}
        disablePreviewLinks={disablePreviewLinks}
        download={download}
        editorFontSize={editorFontSize}
        filter={filter}
        filterHistory={filterHistory}
        key={responseId}
        responseId={responseId}
        url={url}
      />
    );
  }

  if (
    previewMode === PREVIEW_MODE_FRIENDLY &&
      contentType.indexOf('audio/') === 0
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
  }

  if (previewMode === PREVIEW_MODE_RAW) {
    return (
      <ResponseRawViewer
        key={responseId}
        responseId={responseId}
        ref={_selectableViewRef}
        value={_getBody()}
      />
    );
  }

  // Show everything else as "source"
  return (
    <CodeEditor
      key={disablePreviewLinks ? 'links-disabled' : 'links-enabled'}
      ref={_selectableViewRef}
      autoPrettify
      defaultValue={_getBody()}
      filter={filter}
      filterHistory={filterHistory}
      mode={_getMode()}
      noMatchBrackets
      onClickLink={disablePreviewLinks ? undefined : _handleClickLink}
      placeholder="..."
      readOnly
      uniquenessKey={responseId}
      updateFilter={updateFilter}
    />
  );
};

ResponseViewer.displayName = 'ResponseViewer';
