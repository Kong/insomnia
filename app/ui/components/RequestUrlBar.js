import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import Dropdown from './base/Dropdown';
import {METHODS, DEBOUNCE_MILLIS} from '../../backend/constants';
import {trackEvent} from '../../backend/analytics';
import {isMac} from '../../backend/appInfo';


class RequestUrlBar extends Component {
  _handleFormSubmit (e) {
    e.preventDefault();
    this.props.sendRequest();
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
          <button type="button">
            {method}
            <i className="fa fa-caret-down"/>
          </button>
          <ul>
            {METHODS.map(method => (
              <li key={method}>
                <button onClick={e => {
                  onMethodChange(method);
                  trackEvent('Request', 'Method Change', {method});
                }}>
                  <div className={classnames('dropdown__inner', `method-${method}`)}>
                    <span className="dropdown__text">
                    {method}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
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
  sendRequest: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  url: PropTypes.string.isRequired,
  method: PropTypes.string.isRequired
};

export default RequestUrlBar;
