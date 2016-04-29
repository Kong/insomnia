import React, {Component, PropTypes} from 'react'

class ResponseBodyWebview extends Component {
  _setBody () {
    const {response} = this.props;
    const {webview} = this.refs;

    const encoded = new Buffer(response.body).toString('base64');
    webview.loadURL(`data:${response.contentType};base64,${encoded}`);
  }

  componentDidUpdate () {
    this._setBody();
  }
  
  shouldComponentUpdate (nextProps) {
    return nextProps.response !== this.props.response;
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
      <webview
        className="grid__cell wide bg-super-light"
        autosize="on"
        ref="webview"
        src=""
      ></webview>
    );
  }
}

ResponseBodyWebview.propTypes = {
  response: PropTypes.object.isRequired
};

export default ResponseBodyWebview;
