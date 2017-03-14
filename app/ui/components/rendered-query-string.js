import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import * as querystring from '../../common/querystring';
import * as misc from '../../common/misc';

@autobind
class RenderedQueryString extends PureComponent {
  constructor (props) {
    super(props);
    this._interval = null;
    this.state = {
      string: ''
    };
  }

  async _debouncedUpdate (props) {
    clearTimeout(this._interval);
    this._interval = setTimeout(() => {
      this._update(props);
    }, 300);
  }

  async _update (props) {
    const {request} = props;
    const enabledParameters = request.parameters.filter(p => !p.disabled);

    let result;
    try {
      result = await props.handleRender({
        url: request.url,
        parameters: enabledParameters
      });
    } catch (err) {
      // Just ignore failures
    }

    if (result) {
      const {url, parameters} = result;
      const qs = querystring.buildFromParams(parameters);
      const fullUrl = querystring.joinUrl(url, qs);
      this.setState({string: misc.prepareUrlForSending(fullUrl)});
    }
  }

  componentDidMount () {
    this._update(this.props);
  }

  componentWillUnmount () {
    clearTimeout(this._interval);
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.request._id !== this.props.request._id) {
      this._update(nextProps);
    } else {
      this._debouncedUpdate(nextProps);
    }
  }

  render () {
    if (this.state.string) {
      return <span className="selectable force-wrap">{this.state.string}</span>;
    } else {
      return <span className="super-duper-faint italic">...</span>;
    }
  }
}

RenderedQueryString.propTypes = {
  request: PropTypes.object.isRequired,
  handleRender: PropTypes.func.isRequired
};

export default RenderedQueryString;
