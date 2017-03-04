import React, {PropTypes, PureComponent} from 'react';
import debounce from 'debounce-decorator';
import autobind from 'autobind-decorator';
import * as querystring from '../../common/querystring';
import * as misc from '../../common/misc';

@autobind
class RenderedQueryString extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {string: ''};
    this._mounted = false;
  }

  @debounce(400)
  _debouncedUpdate (props) {
    return this._update(props);
  }

  async _update (props) {
    if (!this._mounted) {
      return;
    }

    const {request} = props;
    const enabledParameters = request.parameters.filter(p => !p.disabled);
    const {url, parameters} = await props.handleRender({
      url: request.url,
      parameters: enabledParameters
    });
    const qs = querystring.buildFromParams(parameters);
    const fullUrl = querystring.joinUrl(url, qs);
    this.setState({string: misc.prepareUrlForSending(fullUrl)});
  }

  componentDidMount () {
    this._mounted = true;
    this._update(this.props);
  }

  componentWillUnmount () {
    this._mounted = false;
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
