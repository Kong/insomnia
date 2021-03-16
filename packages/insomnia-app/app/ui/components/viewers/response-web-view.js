// @flow
import * as React from 'react';
import { EventEmitter } from 'events';
import autobind from 'autobind-decorator';
import contextMenu from 'electron-context-menu';

type Props = {
  body: string,
  contentType: string,
  url: string,
  webpreferences: string,
};

@autobind
class ResponseWebView extends React.PureComponent<Props> {
  _webview: ?HTMLElement;

  _handleSetWebViewRef(n: ?HTMLElement) {
    this._webview = n;

    if (this._webview) {
      this._webview.addEventListener('dom-ready', this._handleDOMReady);
    }
  }

  _handleDOMReady() {
    if (!this._webview) {
      return;
    }

    this._webview.removeEventListener('dom-ready', this._handleDOMReady);
    contextMenu({ window: this._webview });
    this._setBody();
  }

  _setBody() {
    const webview: Object = this._webview;

    if (!webview) {
      return;
    }

    const { body, contentType, url } = this.props;
    const bodyWithBase = body.replace('<head>', `<head><base href="${url}">`);
    webview.loadURL(`data:${contentType},${encodeURIComponent(bodyWithBase)}`);

    // NOTE: We *should* be setting the base URL by specifying the baseURLForDataURL
    // option, but there is a bug in baseURLForDataURL since Electron 6 (still exists
    // in 9) that makes it impossible.
    //
    // For now we inject the <base> tag to achieve a similar effect. This was actually the
    // way we did it before discovering the baseURLForDataURL setting.
    //
    //    https://github.com/electron/electron/issues/20700
    //
    // webview.loadURL(`data:${contentType},${encodeURIComponent(body)}`, {
    //   baseURLForDataURL: url,
    // });

    // This is kind of hacky but electron-context-menu fails to save images if
    // this isn't here.
    webview.webContents = webview;
    webview.webContents.session = new EventEmitter();
  }

  componentDidUpdate() {
    this._setBody();
  }

  render() {
    const { webpreferences } = this.props;

    return (
      <webview ref={this._handleSetWebViewRef} src="about:blank" webpreferences={webpreferences} />
    );
  }
}

export default ResponseWebView;
