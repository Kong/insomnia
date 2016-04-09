import React, {Component, PropTypes} from 'react'
import DebouncingInput from './base/DebouncingInput';
import Dropdown from './base/Dropdown';
import {METHODS} from '../constants/global';

class UrlInput extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.request !== nextProps.request;
  }

  render () {
    const {onUrlChange, onMethodChange, request} = this.props;
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
        <DebouncingInput
          type="text"
          className="grid__cell txt-lg"
          placeholder="http://echo.insomnia.rest/status/200"
          value={request.url}
          debounceMillis={1000}
          onChange={onUrlChange}/>
        <button className="btn">
          <i className="fa fa-repeat txt-xl"></i>
        </button>
      </div>
    )
  }
}

UrlInput.propTypes = {
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  request: PropTypes.shape({
    url: PropTypes.string.isRequired,
    method: PropTypes.string.isRequired
  }).isRequired
};

export default UrlInput;
