import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'

import Input from './base/Input';
import Dropdown from './base/Dropdown';
import {METHODS} from '../lib/constants';

class UrlInput extends Component {
  _handleFormSubmit (e) {
    e.preventDefault();
    this.props.sendRequest();
  }

  render () {
    const {onUrlChange, onMethodChange, uniquenessKey, url, method} = this.props;

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
            type="text"
            placeholder="http://echo.insomnia.rest/status/200"
            value={url}
            uniquenessKey={uniquenessKey}
            onChange={onUrlChange}/>
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
