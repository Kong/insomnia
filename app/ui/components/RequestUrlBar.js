import React, {Component, PropTypes} from 'react';
import {DEBOUNCE_MILLIS, isMac} from '../../common/constants';
import {trackEvent} from '../../analytics';
import MethodDropdown from './dropdowns/MethodDropdown';


class RequestUrlBar extends Component {
  _handleFormSubmit = e => {
    e.preventDefault();
    this.props.handleSend();
  };

  _handleMethodChange = method => {
    this.props.onMethodChange(method);
    trackEvent('Request', 'Method Change', method);
  };

  _handleUrlChange = e => {
    const url = e.target.value;

    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this.props.onUrlChange(url);
    }, DEBOUNCE_MILLIS);
  };

  componentDidMount () {
    this._bodyKeydownHandler = e => {
      if (!this._input) {
        return;
      }

      // meta+l
      const metaPressed = isMac() ? e.metaKey : e.ctrlKey;
      if (metaPressed && e.keyCode === 76) {
        e.preventDefault();
        this._input.focus();
        this._input.select();
      }
    };

    document.body.addEventListener('keydown', this._bodyKeydownHandler);
  }

  componentWillUnmount () {
    document.body.removeEventListener('keydown', this._bodyKeydownHandler);
  }

  render () {
    const {url, method} = this.props;
    return (
      <div className="urlbar">
        <MethodDropdown onChange={this._handleMethodChange} method={method}>
          {method} <i className="fa fa-caret-down"/>
        </MethodDropdown>
        <form onSubmit={this._handleFormSubmit}>
          <div className="form-control">
            <input
              ref={n => this._input = n}
              type="text"
              placeholder="https://api.myproduct.com/v1/users"
              defaultValue={url}
              onChange={this._handleUrlChange}/>
          </div>
          <div className="no-wrap">
            <button type="submit">
              Send
            </button>
          </div>
        </form>
      </div>
    );
  }
}

RequestUrlBar.propTypes = {
  handleSend: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  url: PropTypes.string.isRequired,
  method: PropTypes.string.isRequired
};

export default RequestUrlBar;
