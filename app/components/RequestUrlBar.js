import React, {Component, PropTypes} from 'react'
import DebouncingInput from './base/DebouncingInput';
import Dropdown from './base/Dropdown';
import {METHODS} from '../constants/global';

class UrlInput extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.request._id !== nextProps.request._id;
  }

  render () {
    const {sendRequest, onUrlChange, onMethodChange, request} = this.props;
    return (
      <div className="grid wide form-control form-control--left form-control--right bg-super-light">
        <Dropdown>
          <button className="btn txt-lg">
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
        <form className="tall grid__cell" onSubmit={e => {e.preventDefault(); sendRequest(request)}}>
          <DebouncingInput
            type="text"
            className="txt-md"
            placeholder="http://echo.insomnia.rest/status/200"
            value={request.url}
            debounceMillis={1000}
            onChange={onUrlChange}/>
        </form>
        <button className="btn txt-lg" onClick={sendRequest.bind(null, request)}>
          Send
        </button>
      </div>
    )
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
