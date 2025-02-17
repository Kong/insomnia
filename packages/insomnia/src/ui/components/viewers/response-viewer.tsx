import iconv from 'iconv-lite';
import React, {
  Fragment,
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  HUGE_RESPONSE_MB,
  LARGE_RESPONSE_MB,
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODE_RAW,
} from '../../../common/constants';
import { CodeEditor, type CodeEditorHandle } from '../codemirror/code-editor';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { ResponseCSVViewer } from './response-csv-viewer';
import { ResponseErrorViewer } from './response-error-viewer';
import { ResponseMultipartViewer } from './response-multipart-viewer';
import { ResponsePDFViewer } from './response-pdf-viewer';
import { ResponseWebView } from './response-web-view';

let alwaysShowLargeResponses = false;

export interface ResponseViewerHandle {
  refresh: () => void;
}
export function xmlDecode(input: string) {
  const ESCAPED_CHARACTERS_MAP = {
    '&amp;': '&',
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
  };

  return input.replace(/(&quot;|&lt;|&gt;|&amp;)/g, (_: string, item: keyof typeof ESCAPED_CHARACTERS_MAP) => (
    ESCAPED_CHARACTERS_MAP[item])
  );
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
  const largeResponse = bytes > LARGE_RESPONSE_MB * 1024 * 1024;
  const hugeResponse = bytes > HUGE_RESPONSE_MB * 1024 * 1024;
  const [blockingBecauseTooLarge, setBlockingBecauseTooLarge] = useState(!alwaysShowLargeResponses && largeResponse);
  const [parseError, setParseError] = useState('');

  const [bodyBuffer, setBodyBuffer] = useState<Buffer | null>(() => {
    let initialBody = null;
    try {
      if (!blockingBecauseTooLarge) {
        initialBody = getBody();
      }
    } catch (err) {
      setParseError(`Failed reading response from filesystem: ${err.stack}`);
    }
    return initialBody;
  });

  const editorRef = useRef<CodeEditorHandle>(null);

  const _handleDismissBlocker = useCallback(() => {
    setBlockingBecauseTooLarge(false);

    try {
      const bodyBuffer = getBody();
      setBodyBuffer(bodyBuffer);
      setBlockingBecauseTooLarge(false);
    } catch (err) {
      setParseError(`Failed reading response from filesystem: ${err.stack}`);
    }
  }, [getBody]);

  const _handleDisableBlocker = useCallback(() => {
    alwaysShowLargeResponses = true;

    _handleDismissBlocker();
  }, [_handleDismissBlocker]);

  // focus the code editor by hotkey
  useDocBodyKeyboardShortcuts({
    response_focus: () => {
      if (editorRef.current) {
        if ('focus' in editorRef.current) {
          editorRef.current.focus();
        }

        if (!largeResponse && 'selectAll' in editorRef.current) {
          editorRef.current.selectAll();
        }
      }
    },
  });

  const _getContentType = useCallback(() => {
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
    } catch (error) { }
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
    } catch (error) { }

    return lowercasedOriginalContentType;
  }, [originalContentType, bodyBuffer]);

  const getBodyAsString = useCallback(() => {
    if (!bodyBuffer) {
      return '';
    }
    // Show everything else as "source"
    const match = _getContentType().match(/charset=([\w-]+)/);
    const charset = match && match.length >= 2 ? match[1] : 'utf-8';
    // Sometimes iconv conversion fails so fallback to regular buffer
    try {
      return iconv.decode(bodyBuffer, charset);
    } catch (err) {
      console.warn('[response] Failed to decode body', err);
      return bodyBuffer.toString();
    }
  }, [bodyBuffer, _getContentType]);

  if (responseError || parseError) {
    return (
      <div className="scrollable tall">
        <ResponseErrorViewer url={url} error={responseError || parseError} />
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
    contentType === 'application/json'
  ) {
    let bodyStr = getBodyAsString();
    // Although there is a prettifier for json inside the CodeEditor, but it is to prettify json strings that is being edited which may have syntax errors.
    // There are some cases that the prettifier inside the CodeEditor can not handle.
    // See https://github.com/Kong/insomnia/issues/1556
    // Here the CodeEditor is readonly and the bodyStr is supposed to be a valid json string.
    // So we try to use the native JSON.stringify to prettify the json string better. The native way can handle the issue.
    try {
      bodyStr = JSON.stringify(JSON.parse(bodyStr));
    } catch (err) { }
    return (
      <CodeEditor
        id="json-response-viewer"
        key={`${responseId}-json`}
        ref={editorRef}
        autoPrettify
        defaultValue={bodyStr}
        filter={filter}
        filterHistory={filterHistory}
        mode={contentType}
        noMatchBrackets
        onClickLink={url => !disablePreviewLinks && window.main.openInBrowser(getBodyAsString()?.match(/^\s*<\?xml [^?]*\?>/) ? xmlDecode(url) : url)}
        placeholder="..."
        readOnly
        uniquenessKey={responseId}
        updateFilter={updateFilter}
      />
    );
  }

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
        body={getBodyAsString()}
        key={disableHtmlPreviewJs ? 'no-js' : 'yes-js'}
        url={url}
        webpreferences={`disableDialogs=true, javascript=${disableHtmlPreviewJs ? 'no' : 'yes'}`}
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
      <CodeEditor
        id="raw-response-viewer"
        key={responseId}
        ref={editorRef}
        className="raw-editor"
        defaultValue={getBodyAsString()}
        hideLineNumbers
        mode="text/plain"
        noMatchBrackets
        placeholder="..."
        readOnly
        uniquenessKey={responseId}
      />
    );
  }

  // Show everything else as "source"
  return (
    <CodeEditor
      id="response-viewer"
      key={disablePreviewLinks ? 'links-disabled' : 'links-enabled'}
      ref={editorRef}
      autoPrettify
      defaultValue={getBodyAsString()}
      filter={filter}
      filterHistory={filterHistory}
      mode={getBodyAsString()?.match(/^\s*<\?xml [^?]*\?>/) ? 'application/xml' : _getContentType()}
      noMatchBrackets
      onClickLink={url => !disablePreviewLinks && window.main.openInBrowser(getBodyAsString()?.match(/^\s*<\?xml [^?]*\?>/) ? xmlDecode(url) : url)}
      placeholder="..."
      readOnly
      uniquenessKey={responseId}
      updateFilter={updateFilter}
    />
  );
};

ResponseViewer.displayName = 'ResponseViewer';
