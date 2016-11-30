import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import {DEBOUNCE_MILLIS, isMac} from '../../common/constants';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider, DropdownHint} from './base/dropdown';
import {trackEvent} from '../../analytics';
import MethodDropdown from './dropdowns/MethodDropdown';
import PromptModal from './modals/PromptModal';
import {showModal} from './modals/index';


class RequestUrlBar extends Component {
  state = {
    showAdvanced: false,
    currentInterval: null,
    currentTimeout: null,
  };

  _handleFormSubmit = e => {
    e.preventDefault();
    this.props.handleSend();
  };

  _handleMethodChange = method => {
    this.props.onMethodChange(method);
    trackEvent('Request', 'Method Change', method);
  };

  _handleUrlChange = e => {
    const url = e.target.value;

    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this.props.onUrlChange(url);
    }, DEBOUNCE_MILLIS);
  };

  _handleGenerateCode = () => {
    this.props.handleGenerateCode();
    trackEvent('Request', 'Generate Code', 'Send Action');
  };

  _handleKeyDown = e => {
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

    if (!this.state.showAdvanced && metaPressed) {
      clearTimeout(this._metaTimeout);
      this._metaTimeout = setTimeout(() => {
        this.setState({showAdvanced: true});
      }, 400);
    }
  };

  _handleKeyUp = e => {
    const metaPressed = isMac() ? e.metaKey : e.ctrlKey;

    // First, clear the meta timeout if it hasn't triggered yet
    if (!metaPressed) {
      clearTimeout(this._metaTimeout);
    }

    if (!metaPressed && this.state.showAdvanced) {
      this.setState({showAdvanced: false});
    }
  };

  _handleSend = () => {
    // Don't stop interval because duh, it needs to keep going!
    // this._handleStopInterval();

    this._handleStopTimeout();
    this.props.handleSend();
  };

  _handleSendAfterDelay = async () => {
    const seconds = await showModal(PromptModal, {
      inputType: 'decimal',
      headerName: 'Send After Delay',
      label: 'Delay in seconds',
      defaultValue: 3,
      submitName: 'Start',
    });

    this._handleStopTimeout();
    this._sendTimeout = setTimeout(this._handleSend, seconds * 1000);
    this.setState({currentTimeout: seconds});

    trackEvent('Request', 'Send on Delay', 'Send Action', seconds);
  };

  _handleSendOnInterval = async () => {
    const seconds = await showModal(PromptModal, {
      inputType: 'decimal',
      headerName: 'Send on Interval',
      label: 'Interval in seconds',
      defaultValue: 3,
      submitName: 'Start',
    });

    this._handleStopInterval();
    this._sendInterval = setInterval(this._handleSend, seconds * 1000);
    this.setState({currentInterval: seconds});

    trackEvent('Request', 'Send on Interval', 'Send Action', seconds);
  };

  _handleStopInterval = () => {
    clearTimeout(this._sendInterval);
    if (this.state.currentInterval) {
      this.setState({currentInterval: null});
    }
    trackEvent('Request', 'Stop Send Interval');
  };

  _handleStopTimeout = () => {
    clearTimeout(this._sendTimeout);
    if (this.state.currentTimeout) {
      this.setState({currentTimeout: null});
    }
    trackEvent('Request', 'Stop Send Timeout');
  };

  componentDidMount () {
    document.body.addEventListener('keydown', this._handleKeyDown);
    document.body.addEventListener('keyup', this._handleKeyUp);
  }

  componentWillUnmount () {
    document.body.removeEventListener('keydown', this._handleKeyDown);
    document.body.removeEventListener('keyup', this._handleKeyUp);
  }

  renderSendButton () {
    const {showAdvanced, currentInterval, currentTimeout} = this.state;

    let cancelButton = null;
    if (currentInterval) {
      cancelButton = (
        <button type="button"
                key="cancel-interval"
                className="urlbar__send-btn danger"
                onClick={this._handleStopInterval}>
          Stop
        </button>
      )
    } else if (currentTimeout) {
      cancelButton = (
        <button type="button"
                key="cancel-timeout"
                className="urlbar__send-btn danger"
                onClick={this._handleStopTimeout}>
          Cancel
        </button>
      )
    }

    let sendButton;
    if (!cancelButton && !showAdvanced) {
      sendButton = (
        <button key="send" type="submit" className="urlbar__send-btn">
          Send
        </button>
      )
    }

    let dropdown = null;
    if (!cancelButton) {
      dropdown = (
        <Dropdown key="dropdown" className="tall" right={true}>
          <DropdownButton className={classnames('urlbar__send-btn', {hide: !showAdvanced})}>
            <i className="fa fa-caret-down"></i>
          </DropdownButton>
          <DropdownDivider name="Basic"/>
          <DropdownItem type="submit">
            <i className="fa fa-arrow-circle-o-right"/> Send Now
            <DropdownHint char="Enter"/>
          </DropdownItem>
          <DropdownItem onClick={this._handleGenerateCode}>
            <i className="fa fa-code"/> Generate Client Code
          </DropdownItem>
          <DropdownDivider name="Advanced"/>
          <DropdownItem onClick={this._handleSendAfterDelay}>
            <i className="fa fa-clock-o"/> Send After Delay
          </DropdownItem>
          <DropdownItem onClick={this._handleSendOnInterval}>
            <i className="fa fa-repeat"/> Repeat on Interval
          </DropdownItem>
        </Dropdown>
      )
    }

    return [
      cancelButton,
      sendButton,
      dropdown,
    ]
  }

  render () {
    const {url, method} = this.props;
    return (
      <div className="urlbar">
        <MethodDropdown onChange={this._handleMethodChange} method={method}>
          {method} <i className="fa fa-caret-down"/>
        </MethodDropdown>
        <form onSubmit={this._handleFormSubmit}>
          <input
            ref={n => this._input = n}
            type="text"
            placeholder="https://api.myproduct.com/v1/users"
            defaultValue={url}
            onChange={this._handleUrlChange}/>
          {this.renderSendButton()}
        </form>
      </div>
    );
  }
}

RequestUrlBar.propTypes = {
  handleSend: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onMethodChange: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  url: PropTypes.string.isRequired,
  method: PropTypes.string.isRequired
};

export default RequestUrlBar;
