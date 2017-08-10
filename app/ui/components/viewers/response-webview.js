import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import contextMenu from 'electron-context-menu';

@autobind
class ResponseWebview extends PureComponent {
  _handleSetWebviewRef (n) {
    this._webview = n;
    if (n) {
      contextMenu({window: this._webview});
    }
  }

  _handleDOMReady () {
    this._webview.removeEventListener('dom-ready', this._handleDOMReady);
    this._setBody();
  }

  _setBody () {
    const {body, contentType, url} = this.props;
    const newBody = body.replace('<head>', `<head><base href="${url}">`);
    this._webview.loadURL(`data:${contentType},${encodeURIComponent(newBody)}`);
  }

  componentDidUpdate () {
    this._setBody();
  }

  componentDidMount () {
    this._webview.addEventListener('dom-ready', this._handleDOMReady);
  }

  render () {
    return (
      <webview ref={this._handleSetWebviewRef} src="about:blank"></webview>
    );
  }
}

ResponseWebview.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired
};

export default ResponseWebview;
