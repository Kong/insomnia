import React, {Component, PropTypes} from 'react'

class ResponseBodyWebview extends Component {
  _setBody () {
    const {body, contentType} = this.props;
    const {webview} = this.refs;

    const encoded = new Buffer(body).toString('base64');
    webview.loadURL(`data:${contentType};base64,${encoded}`);
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
      <webview ref="webview" src=""></webview>
    );
  }
}

ResponseBodyWebview.propTypes = {
  body: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired
};

export default ResponseBodyWebview;
