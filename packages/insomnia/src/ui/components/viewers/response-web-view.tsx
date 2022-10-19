import React, { FC, useCallback, useEffect, useRef } from 'react';

interface Props {
  body: string;
  contentType: string;
  url: string;
  webpreferences: string;
}
export const ResponseWebView: FC<Props> = ({ webpreferences, body, contentType, url }) => {
  const webviewRef = useRef<Electron.WebviewTag>(null);

  const handleDOMReady = useCallback(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.removeEventListener('dom-ready', handleDOMReady);
      const bodyWithBase = body.replace('<head>', `<head><base href="${url}">`);
      webview.loadURL(`data:${contentType},${encodeURIComponent(bodyWithBase)}`);
    }
  }, [body, contentType, url]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.addEventListener('dom-ready', handleDOMReady);
    }
    return () => {
      if (webview) {
        webview.removeEventListener('dom-ready', handleDOMReady);
      }
    };
  }, [handleDOMReady]);
  return (
    <webview
      data-testid="ResponseWebView"
      ref={webviewRef}
      src="about:blank"
      webpreferences={webpreferences}
    />
  );
};
