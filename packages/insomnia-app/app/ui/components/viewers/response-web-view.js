import React, { PureComponent } from 'react';
import { EventEmitter } from 'events';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import contextMenu from 'electron-context-menu';

@autobind
class ResponseWebView extends PureComponent {
  _handleSetWebViewRef(n) {
    this._webview = n;
  }

  _handleDOMReady() {
    this._webview.removeEventListener('dom-ready', this._handleDOMReady);
    contextMenu({ window: this._webview });
    this._setBody();
  }

  _setBody() {
    const { body, contentType, url } = this.props;
    this._webview.loadURL(`data:${contentType},${encodeURIComponent(body)}`, {
      baseURLForDataURL: url,
    });

    // This is kind of hacky but electron-context-menu fails to save images if
    // this isn't here.
    this._webview.webContents = this._webview;
    this._webview.webContents.session = new EventEmitter();
  }

  componentDidUpdate() {
    this._setBody();
  }

  componentDidMount() {
    this._webview.addEventListener('dom-ready', this._handleDOMReady);
  }

  render() {
    return <webview ref={this._handleSetWebViewRef} src="about:blank" />;
  }
}

ResponseWebView.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
};

export default ResponseWebView;
