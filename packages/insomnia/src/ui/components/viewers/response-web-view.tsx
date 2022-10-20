import React, { FC, useEffect, useRef } from 'react';

interface Props {
  body: string;
  contentType: string;
  url: string;
  webpreferences: string;
}
export const ResponseWebView: FC<Props> = ({ webpreferences, body, contentType, url }) => {
  const webviewRef = useRef<Electron.WebviewTag>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    const handleDOMReady = () => {
      if (webview) {
        webview.removeEventListener('dom-ready', handleDOMReady);
        const bodyWithBase = body.replace('<head>', `<head><base href="${url}">`);
        webview.loadURL(`data:${contentType},${encodeURIComponent(bodyWithBase)}`);
      }
    };
    if (webview) {
      webview.addEventListener('dom-ready', handleDOMReady);
    }
    return () => {
      if (webview) {
        webview.removeEventListener('dom-ready', handleDOMReady);
      }
    };
  }, [body, contentType, url]);
  return (
    <webview
      data-testid="ResponseWebView"
      ref={webviewRef}
      src="about:blank"
      webpreferences={webpreferences}
    />
  );
};
