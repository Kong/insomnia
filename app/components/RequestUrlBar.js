import React, {Component, PropTypes} from 'react'
import DebouncingInput from './base/DebouncingInput';
import Dropdown from './base/Dropdown';
import {METHODS} from '../lib/constants';

class UrlInput extends Component {
  _handleFormSubmit (e) {
    e.preventDefault();
    this.props.sendRequest();
  }

  render () {
    const {onUrlChange, onMethodChange, uniquenessKey, url, method} = this.props;
    return (
      <div className="tall grid grid--center wide bg-super-light">
        <Dropdown className="tall">
          <button className="pad tall txt-md">
            {method}&nbsp;
            <i className="fa fa-caret-down"></i>
          </button>
          <ul>
            {METHODS.map(m => (
              <li key={m}>
                <button onClick={onMethodChange.bind(null, m)}>{m}</button>
              </li>
            ))}
          </ul>
        </Dropdown>
        <form className="tall grid__cell form-control form-control--wide"
              onSubmit={this._handleFormSubmit.bind(this)}>
          <DebouncingInput
            type="text"
            className="txt-md"
            placeholder="http://echo.insomnia.rest/status/200"
            value={url}
            debounceMillis={1000}
            uniquenessKey={uniquenessKey}
            onChange={onUrlChange}/>
        </form>
        <button className="btn btn--compact txt-lg" onClick={this._handleFormSubmit.bind(this)}>
          Send
        </button>&nbsp;&nbsp;
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
