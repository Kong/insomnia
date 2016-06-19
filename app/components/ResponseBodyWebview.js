import React, {Component, PropTypes} from 'react'

class ResponseBodyWebview extends Component {
  _setBody () {
    const {body, contentType, url} = this.props;
    const {webview} = this.refs;

    const newBody = body.replace('<head>', `<head><base href="${url}">`);
    webview.loadURL(`data:${contentType},${encodeURIComponent(newBody)}`);
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
    const {webview} = this.refs;

    const cb = () => {
      webview.removeEventListener('dom-ready', cb);
      this._setBody();
    };

    webview.addEventListener('dom-ready', cb);
  }

  render () {
    return (
      <webview ref="webview" src="about:blank"></webview>
    );
  }
}

ResponseBodyWebview.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired
};

export default ResponseBodyWebview;
