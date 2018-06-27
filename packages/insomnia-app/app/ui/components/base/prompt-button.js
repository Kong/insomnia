import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import Button from './button';

const STATE_DEFAULT = 'default';
const STATE_ASK = 'ask';
const STATE_DONE = 'done';

@autobind
class PromptButton extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      state: STATE_DEFAULT
    };
  }

  _confirm(...args) {
    // Clear existing timeouts
    clearTimeout(this._triggerTimeout);

    // Fire the click handler
    this.props.onClick(...args);

    // Set the state to done (but delay a bit to not alarm user)
    this._doneTimeout = setTimeout(() => {
      this.setState({ state: STATE_DONE });
    }, 100);

    // Set a timeout to hide the confirmation
    this._triggerTimeout = setTimeout(() => {
      this.setState({ state: STATE_DEFAULT });
    }, 2000);
  }

  _ask(...args) {
    const e = args[args.length - 1];

    // Prevent events (ex. won't close dropdown if it's in one)
    e.preventDefault();
    e.stopPropagation();

    // Toggle the confirmation notice
    this.setState({ state: STATE_ASK });

    // Set a timeout to hide the confirmation
    this._triggerTimeout = setTimeout(() => {
      this.setState({ state: STATE_DEFAULT });
    }, 2000);
  }

  _handleClick(...args) {
    const { state } = this.state;
    if (state === STATE_ASK) {
      this._confirm(...args);
    } else if (state === STATE_DEFAULT) {
      this._ask(...args);
    } else {
      // Do nothing
    }
  }

  componentWillUnmount() {
    clearTimeout(this._triggerTimeout);
    clearTimeout(this._doneTimeout);
  }

  render() {
    const {
      onClick, // eslint-disable-line no-unused-vars
      children,
      addIcon,
      disabled,
      confirmMessage,
      doneMessage,
      tabIndex,
      ...other
    } = this.props;

    const { state } = this.state;

    const finalConfirmMessage = (confirmMessage || 'Click to confirm').trim();
    const finalDoneMessage = doneMessage || 'Done';

    let innerMsg;
    if (state === STATE_ASK && addIcon) {
      innerMsg = (
        <span className="warning" title="Click again to confirm">
          <i className="fa fa-exclamation-circle" />
          {finalConfirmMessage ? (
            <span className="space-left">{finalConfirmMessage}</span>
          ) : (
            ''
          )}
        </span>
      );
    } else if (state === STATE_ASK) {
      innerMsg = (
        <span className="warning" title="Click again to confirm">
          {finalConfirmMessage}
        </span>
      );
    } else if (state === STATE_DONE) {
      innerMsg = finalDoneMessage;
    } else {
      innerMsg = children;
    }

    return (
      <Button
        onClick={this._handleClick}
        disabled={disabled}
        tabIndex={tabIndex}
        {...other}>
        {innerMsg}
      </Button>
    );
  }
}

PromptButton.propTypes = {
  onClick: PropTypes.func,
  addIcon: PropTypes.bool,
  children: PropTypes.node,
  disabled: PropTypes.bool,
  confirmMessage: PropTypes.string,
  doneMessage: PropTypes.string,
  value: PropTypes.any,
  tabIndex: PropTypes.number
};

export default PromptButton;
