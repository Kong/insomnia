import React, {PropTypes, Component} from 'react';
import {getRenderedRequest} from '../../common/render';
import * as querystring from '../../common/querystring';
import * as util from '../../common/misc';


class RenderedQueryString extends Component {
  constructor (props) {
    super(props);
    this.state = {
      string: ''
    }
  }

  _update (props, delay = false) {
    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(async () => {
      const {request, environmentId} = props;
      const {url, parameters} = await getRenderedRequest(request, environmentId);
      const qs = querystring.buildFromParams(parameters);
      const fullUrl = querystring.joinURL(url, qs);
      this.setState({string: util.prepareUrlForSending(fullUrl)});
    }, delay ? 200 : 0);
  }

  componentDidMount () {
    this._update(this.props);
  }

  componentWillUnmount () {
    clearTimeout(this._triggerTimeout);
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
  environmentId: PropTypes.string.isRequired,

  // Optional
  placeholder: PropTypes.string
};

export default RenderedQueryString;
