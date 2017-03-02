import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import * as querystring from '../../common/querystring';
import * as util from '../../common/misc';

@autobind
class RenderedQueryString extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      string: ''
    };
  }

  _update (props, delay = false) {
    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(async () => {
      const {request} = props;
      const {url, parameters} = await props.handleRender({
        url: request.url,
        parameters: request.parameters
      });
      const qs = querystring.buildFromParams(parameters);
      const fullUrl = querystring.joinUrl(url, qs);
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
      return <span className="super-duper-faint italic">...</span>
    }
  }
}


RenderedQueryString.propTypes = {
  request: PropTypes.object.isRequired,
  handleRender: PropTypes.func.isRequired,
};

export default RenderedQueryString;
