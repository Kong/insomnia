import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';

import Input from './base/Input';
import Dropdown from './base/Dropdown';
import MethodTag from './MethodTag';
import {METHODS} from '../lib/constants';
import Mousetrap from '../lib/mousetrap';


class RequestUrlBar extends Component {
  _handleFormSubmit (e) {
    e.preventDefault();
    this.props.sendRequest();
  }

  _handleUrlChange (url) {
    this.props.onUrlChange(url);
  }

  focus () {
    this.refs.input.focus();
    console.log('-- Focus URL Bar --');
  }

  componentDidMount () {
    Mousetrap.bindGlobal('mod+l', this.focus.bind(this));
  }

  componentWillUnmount () {
    Mousetrap.unbind('mod+l');
  }

  render () {
    const {onMethodChange, url, method} = this.props;

    // TODO: Implement proper error checking here
    const hasError = !url;

    return (
      <div className={classnames({'urlbar': true, 'urlbar--error': hasError})}>
        <Dropdown>
          <button>
            <div className="tall">
              <span>{method}</span>
              <i className="fa fa-caret-down"/>
            </div>
          </button>
          <ul>
            {METHODS.map(m => (
              <li key={m}>
                <button onClick={onMethodChange.bind(null, m)}>
                  <MethodTag method={m} fullNames={true}/>
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

RequestUrlBar.propTypes = {
  sendRequest: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  url: PropTypes.string.isRequired,
  method: PropTypes.string.isRequired
};

export default RequestUrlBar;
