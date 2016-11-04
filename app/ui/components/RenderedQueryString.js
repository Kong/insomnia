import React, {PropTypes, Component} from 'react';
import {getRenderedRequest} from '../../backend/render';
import * as querystring from '../../backend/querystring';
import * as util from '../../backend/util';


class RenderedQueryString extends Component {
  constructor (props) {
    super(props);
    this.state = {
      string: ''
    }
  }

  _update (props, delay = false) {
    clearTimeout(this._askTimeout);
    this._askTimeout = setTimeout(async () => {
      const {url, parameters} = await getRenderedRequest(props.request);
      const qs = querystring.buildFromParams(parameters);
      const fullUrl = querystring.joinURL(url, qs);
      this.setState({string: util.prepareUrlForSending(fullUrl)});
    }, delay ? 300 : 0);
  }

  componentDidMount () {
    this._update(this.props);
  }

  componentWillUnmount () {
    clearTimeout(this._askTimeout);
  }

  componentWillReceiveProps (nextProps) {
    let delay = true;

    // Update right away if we're switching requests
    if (nextProps.request._id !== this.props.request._id) {
      delay = false;
    }

    this._update(nextProps, delay);
  }

  render () {
    if (this.state.string) {
      return <span className="selectable force-wrap">{this.state.string}</span>
    } else {
      return <span className="super-faint">{this.props.placeholder || ''}</span>
    }
  }
}


RenderedQueryString.propTypes = {
  request: PropTypes.object.isRequired,

  // Optional
  placeholder: PropTypes.string
};

export default RenderedQueryString;
