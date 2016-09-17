import React, {PropTypes, Component} from 'react';
import {getRenderedRequest} from '../../lib/render';
import * as querystring from '../../lib/querystring';


class RenderedQueryString extends Component {
  constructor (props) {
    super(props);
    this.state = {
      string: ''
    }
  }

  _update (props, delay = false) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      getRenderedRequest(props.request).then(({url, parameters}) => {
        const qs = querystring.buildFromParams(parameters);
        const fullUrl = querystring.joinURL(url, qs);
        this.setState({string: fullUrl});
      });
    }, delay ? 300 : 0);
  }

  componentDidMount () {
    this._update(this.props);
  }

  componentWillUnmount () {
    clearTimeout(this._timeout);
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
