import React, { FC, useEffect, useRef } from 'react';

interface Props {
  body: string;
  url: string;
  webpreferences: string;
}
export const ResponseWebView: FC<Props> = ({ webpreferences, body, url }) => {
  const webviewRef = useRef<Electron.WebviewTag>(null);

  useEffect(() => {
    const webview = webviewRef.current;
    const handleDOMReady = () => {
      if (webview) {
        webview.removeEventListener('dom-ready', handleDOMReady);
        const bodyWithBase = body.replace('<head>', `<head><base href="${url}">`);
        webview.loadURL(`data:text/html; charset=utf-8,${encodeURIComponent(bodyWithBase)}`);
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
  }, [body, url]);
  return (
    <webview
      data-testid="ResponseWebView"
      ref={webviewRef}
      src="about:blank"
      // eslint-disable-next-line react/no-unknown-property
      webpreferences={webpreferences}
    />
  );
};
