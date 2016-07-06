import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'

import Input from './base/Input'
import Dropdown from './base/Dropdown'
import {METHODS, DEBOUNCE_MILLIS} from '../lib/constants'
import Mousetrap from '../lib/mousetrap'

class UrlInput extends Component {
  _handleFormSubmit(e) {
    e.preventDefault();
    this.props.sendRequest();
  }

  _handleUrlChange(url) {
    // Debounce URL changes so we don't update the app so much
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.props.onUrlChange(url);
    }, DEBOUNCE_MILLIS);
  }

  focus() {
    this.refs.input.focus();
    console.log('-- Focus URL Bar --');
  }

  componentDidMount() {
    Mousetrap.bindGlobal('mod+l', this.focus.bind(this));
  }

  componentWillUnmount() {
    Mousetrap.unbind('mod+l');
  }

  render() {
    const {onMethodChange, uniquenessKey, url, method} = this.props;

    // TODO: Implement proper error checking here
    const hasError = !url;

    return (
      <div className={classnames({'urlbar': true, 'urlbar--error': hasError})}>
        <Dropdown>
          <button>
            {method}&nbsp;
            <i className="fa fa-caret-down"></i>
          </button>
          <ul>
            {METHODS.map(m => (
              <li key={m}>
                <button onClick={onMethodChange.bind(null, m)}>
                  {m}
                </button>
              </li>
            ))}
          </ul>
        </Dropdown>
        <form className="form-control" onSubmit={this._handleFormSubmit.bind(this)}>
          <Input
            ref="input"
            type="text"
            placeholder="http://echo.insomnia.rest/status/200"
            value={url}
            onChange={url => this._handleUrlChange(url)}/>
        </form>
        <button onClick={this._handleFormSubmit.bind(this)}>
          Send
        </button>
      </div>
    );
  }
}

UrlInput.propTypes = {
  sendRequest: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  uniquenessKey: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  method: PropTypes.string.isRequired
};

export default UrlInput;
