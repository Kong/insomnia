import { autoBindMethodsForReact } from 'class-autobind-decorator';
import contextMenu from 'electron-context-menu';
import { EventEmitter } from 'events';
import React, { createRef, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  body: string;
  contentType: string;
  url: string;
  webpreferences: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseWebView extends PureComponent<Props> {
  webview = createRef<HTMLWebViewElement>();

  componentDidMount() {
    if (!this.webview.current) {
      // This is not supposed to be possible in react since the webview is not conditionally rendered (i.e. it's always rendered), but putting an error here just in case.
      console.error('ResponseWebView was mounted without a ref to the underlying webview');
      return;
    }

    this.webview.current.addEventListener('dom-ready', this._handleDOMReady);
  }

  componentDidUpdate() {
    this._setBody();
  }

  _handleDOMReady() {
    if (!this.webview.current) {
      return;
    }

    this.webview.current.removeEventListener('dom-ready', this._handleDOMReady);

    contextMenu({
      // @ts-expect-error -- TSCONVERSION type mismatch
      window: this.webview.current,
    });

    this._setBody();
  }

  _setBody() {
    if (!this.webview.current) {
      return;
    }

    const { body, contentType, url } = this.props;
    const bodyWithBase = body.replace('<head>', `<head><base href="${url}">`);

    // NOTE: We *should* be setting the base URL by specifying the baseURLForDataURL option, but there is a bug in baseURLForDataURL since Electron 6 (that still exists in 9) that makes it impossible.
    //
    // For now we inject the <base> tag to achieve a similar effect. This was actually the way we did it before discovering the baseURLForDataURL setting.
    //
    //    https://github.com/electron/electron/issues/20700
    //
    // webview.loadURL(`data:${contentType},${encodeURIComponent(body)}`, {
    //   baseURLForDataURL: url,
    // });
    // @ts-expect-error -- TSCONVERSION type mismatch
    this.webview.current.loadURL(`data:${contentType},${encodeURIComponent(bodyWithBase)}`);

    // This is kind of hacky but electron-context-menu fails to save images if this isn't here.
    // @ts-expect-error -- TSCONVERSION type mismatch
    this.webview.current.webContents = this.webview.current;
    // @ts-expect-error -- TSCONVERSION type mismatch
    this.webview.current.webContents.session = new EventEmitter();
  }

  render() {
    const { webpreferences } = this.props;
    return (
      <webview
        data-testid="ResponseWebView"
        ref={this.webview}
        src="about:blank"
        webpreferences={webpreferences}
      />
    );
  }
}
