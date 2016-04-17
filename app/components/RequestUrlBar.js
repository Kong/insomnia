import React, {Component, PropTypes} from 'react'
import DebouncingInput from './base/DebouncingInput';
import Dropdown from './base/Dropdown';
import {METHODS} from '../constants/global';

class UrlInput extends Component {
  render () {
    const {sendRequest, onUrlChange, onMethodChange, request} = this.props;
    return (
      <div className="tall grid grid--center wide bg-super-light">
        <Dropdown className="tall">
          <button className="pad tall txt-sm">
            {request.method}&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
          </button>
          <ul>
            {METHODS.map((method) => (
              <li key={method}>
                <button onClick={onMethodChange.bind(null, method)}>
                  {method}
                </button>
              </li>
            ))}
          </ul>
        </Dropdown>
        <form className="tall grid__cell form-control form-control--wide"
              onSubmit={e => {e.preventDefault(); sendRequest(request)}}>
          <DebouncingInput
            type="text"
            className="txt-md"
            placeholder="http://echo.insomnia.rest/status/200"
            value={request.url}
            debounceMillis={1000}
            uniquenessKey={request._id}
            onChange={onUrlChange}/>
        </form>
        <button className="btn btn--compact txt-lg" onClick={sendRequest.bind(null, request)}>
          <i className="fa fa-arrow-circle-o-right"></i>
        </button>
      </div>
    );
  }
}

UrlInput.propTypes = {
  sendRequest: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  request: PropTypes.shape({
    url: PropTypes.string.isRequired,
    method: PropTypes.string.isRequired
  }).isRequired
};

export default UrlInput;
