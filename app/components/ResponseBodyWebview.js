import React, {Component, PropTypes} from 'react';

class ResponseBodyWebview extends Component {
  _setBody () {
    const {body, contentType, url} = this.props;
    const {webView} = this.refs;

    const newBody = body.replace('<head>', `<head><base href="${url}">`);
    webView.loadURL(`data:${contentType},${encodeURIComponent(newBody)}`);
  }

  componentDidUpdate () {
    this._setBody();
  }

  shouldComponentUpdate (nextProps) {
    for (let key in nextProps) {
      if (nextProps.hasOwnProperty(key)) {
        if (nextProps[key] !== this.props[key]) {
          return true;
        }
      }
    }

    return false;
  }

  componentDidMount () {
    const {webView} = this.refs;

    const cb = () => {
      webView.removeEventListener('dom-ready', cb);
      this._setBody();
    };

    webView.addEventListener('dom-ready', cb);
  }

  render () {
    return (
      <webview ref="webView" src="about:blank"></webview>
    );
  }
}

ResponseBodyWebview.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired
};

export default ResponseBodyWebview;
