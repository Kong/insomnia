import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import {Dropdown, DropdownButton, DropdownItem} from './base/dropdown';
import {METHODS, DEBOUNCE_MILLIS, isMac} from '../../common/constants';
import {trackEvent} from '../../analytics';


class RequestUrlBar extends Component {
  _handleFormSubmit (e) {
    e.preventDefault();
    this.props.handleSend();
  }

  _handleUrlChange (url) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this.props.onUrlChange(url);
    }, DEBOUNCE_MILLIS);
  }

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
    const {onMethodChange, url, method} = this.props;
    return (
      <div className="urlbar">
        <Dropdown>
          <DropdownButton type="button">
            {method} <i className="fa fa-caret-down"/>
          </DropdownButton>
          {METHODS.map(method => (
            <DropdownItem key={method} className={`method-${method}`} onClick={e => {
              onMethodChange(method);
              trackEvent('Request', 'Method Change', {method});
            }}>
              {method}
            </DropdownItem>
          ))}
        </Dropdown>
        <form onSubmit={this._handleFormSubmit.bind(this)}>
          <div className="form-control">
            <input
              ref={n => this._input = n}
              type="text"
              placeholder="https://api.myproduct.com/v1/users"
              defaultValue={url}
              onClick={e => e.preventDefault()}
              onChange={e => this._handleUrlChange(e.target.value)}/>
          </div>
          <button type="submit">Send</button>
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
