import React, {Component, PropTypes} from 'react'
import Input from './base/DebouncingInput';
import Dropdown from './base/Dropdown';
import {METHODS} from '../constants/global';

class UrlInput extends Component {
  shouldComponentUpdate(nextProps) {
    return this.props.request !== nextProps.request;
  }
  render () {
    const {onUrlChange, onMethodChange, request} = this.props;
    return (
      <div className="grid form-control form-control--left form-control--right">
        <Dropdown>
          <button className="btn txt-md">
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
        <Input type="text"
               className="txt-md"
               placeholder="http://echo.insomnia.rest/status/200"
               initialValue={request.url}
               onChange={onUrlChange}/>
        <button className="btn">
          <i className="fa fa-repeat txt-lg"></i>
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
