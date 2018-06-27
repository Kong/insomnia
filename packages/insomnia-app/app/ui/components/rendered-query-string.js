import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl
} from 'insomnia-url';
import CopyButton from './base/copy-button';

@autobind
class RenderedQueryString extends PureComponent {
  constructor(props) {
    super(props);
    this._interval = null;
    this.state = {
      string: ''
    };
  }

  async _debouncedUpdate(props) {
    clearTimeout(this._interval);
    this._interval = setTimeout(() => {
      this._update(props);
    }, 300);
  }

  async _update(props) {
    const { request } = props;
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
      const { url, parameters } = result;
      const qs = buildQueryStringFromParams(parameters);
      const fullUrl = joinUrlAndQueryString(url, qs);
      this.setState({
        string: smartEncodeUrl(fullUrl, request.settingEncodeUrl)
      });
    }
  }

  componentDidMount() {
    this._update(this.props);
  }

  componentWillUnmount() {
    clearTimeout(this._interval);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.request._id !== this.props.request._id) {
      this._update(nextProps);
    } else {
      this._debouncedUpdate(nextProps);
    }
  }

  render() {
    let inner = null;
    if (this.state.string) {
      inner = (
        <span className="selectable force-wrap">{this.state.string}</span>
      );
    } else {
      inner = <span className="super-duper-faint italic">...</span>;
    }

    return (
      <div className="wide scrollable">
        <CopyButton
          content={this.state.string}
          className="pull-right text-right icon"
          title="Copy URL"
          confirmMessage="">
          <i className="fa fa-copy" />
        </CopyButton>
        {inner}
      </div>
    );
  }
}

RenderedQueryString.propTypes = {
  request: PropTypes.object.isRequired,
  handleRender: PropTypes.func.isRequired
};

export default RenderedQueryString;
