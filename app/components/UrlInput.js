import React, {Component, PropTypes} from 'react'
import Input from '../components/Input';
import Dropdown from '../components/Dropdown';
import {METHODS} from '../constants/global';

class UrlInput extends Component {
  render () {
    const {onUrlChange, onMethodChange, urlValue, method} = this.props;
    return (
      <div className="grid form-control form-control--left form-control--right">
        <Dropdown>
          <button className="btn txt-lg">
            {method}&nbsp;&nbsp;<i className="fa fa-caret-down"></i>
          </button>
          <ul className="bg-super-light">
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
               className="txt-lg"
               placeholder="https://google.com"
               initialValue={urlValue}
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
  urlValue: PropTypes.string.isRequired,
  method: PropTypes.string.isRequired
};

export default UrlInput;
