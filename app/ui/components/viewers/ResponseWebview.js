import React, {PureComponent, PropTypes} from 'react';

class ResponseWebview extends PureComponent {
  _handleSetWebviewRef = n => this._webview = n;

  _setBody () {
    const {body, contentType, url} = this.props;
    const newBody = body.replace('<head>', `<head><base href="${url}">`);
    this._webview.loadURL(`data:${contentType},${encodeURIComponent(newBody)}`);
  }

  componentDidUpdate () {
    this._setBody();
  }

  componentDidMount () {
    this._webview.addEventListener('dom-ready', () => {
      this._webview.removeEventListener('dom-ready', cb);
      this._setBody();
    });
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
