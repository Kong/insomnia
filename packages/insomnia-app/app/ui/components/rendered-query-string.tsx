import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../common/constants';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from 'insomnia-url';
import CopyButton from './base/copy-button';
import { HandleRender } from '../../common/render';

interface Props {
  request: any,
  handleRender: HandleRender,
}

interface State {
  string: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class RenderedQueryString extends PureComponent<Props, State> {
  state: State = {
    string: '',
  };

  _interval: NodeJS.Timeout | null = null;

  async _debouncedUpdate(props: Props) {
    if (this._interval !== null) {
      clearTimeout(this._interval);
      this._interval = setTimeout(() => {
        this._update(props);
      }, 300);
    }
  }

  async _update(props: Props) {
    const { request } = props;
    const enabledParameters = request.parameters.filter(p => !p.disabled);
    let result;

    try {
      result = await props.handleRender({
        url: request.url,
        parameters: enabledParameters,
      });
    } catch (err) {
      // Just ignore failures
    }

    if (result) {
      const { url, parameters } = result;
      const qs = buildQueryStringFromParams(parameters);
      const fullUrl = joinUrlAndQueryString(url, qs);
      this.setState({
        string: smartEncodeUrl(fullUrl, request.settingEncodeUrl),
      });
    }
  }

  componentDidMount() {
    this._update(this.props);
  }

  componentWillUnmount() {
    if (this._interval !== null) {
      clearTimeout(this._interval);
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.request._id !== this.props.request._id) {
      this._update(nextProps);
    } else {
      this._debouncedUpdate(nextProps);
    }
  }

  render() {
    const { string } = this.state;

    const inner = string ? (
      <span className="selectable force-wrap">{this.state.string}</span>
    ) : (
      <span className="super-duper-faint italic">...</span>
    );

    return (
      <div className="wide scrollable">
        <CopyButton
          size="small"
          content={this.state.string}
          className="pull-right"
          title="Copy URL"
          confirmMessage="">
          <i className="fa fa-copy" />
        </CopyButton>
        {inner}
      </div>
    );
  }
}

export default RenderedQueryString;
