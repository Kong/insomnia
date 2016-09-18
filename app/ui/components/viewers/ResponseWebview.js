import React, {Component, PropTypes} from 'react';

class ResponseWebview extends Component {
  _setBody () {
    const {body, contentType, url} = this.props;

    const newBody = body.replace('<head>', `<head><base href="${url}">`);
    this._webview.loadURL(`data:${contentType},${encodeURIComponent(newBody)}`);
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
    const cb = () => {
      this._webview.removeEventListener('dom-ready', cb);
      this._setBody();
    };

    this._webview.addEventListener('dom-ready', cb);
  }

  render () {
    return (
      <webview ref={node => this._webview = node} src="about:blank"></webview>
    );
  }
}

ResponseWebview.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired
};

export default ResponseWebview;
