import React, {Component, PropTypes} from 'react';

const STATE_DEFAULT = 'default';
const STATE_ASK = 'ask';
const STATE_DONE = 'done';

class PromptButton extends Component {
  state = {state: STATE_DEFAULT};

  _confirm (e) {
    // Clear existing timeouts
    clearTimeout(this._triggerTimeout);

    // Fire the click handler
    this.props.onClick(e);

    // Set the state to done (but delay a bit to not alarm user)
    this._doneTimeout = setTimeout(() => {
      this.setState({state: STATE_DONE});
    }, 100);

    // Set a timeout to hide the confirmation
    this._triggerTimeout = setTimeout(() => {
      this.setState({state: STATE_DEFAULT});
    }, 2000);
  }

  _ask (e) {
    // Prevent events (ex. won't close dropdown if it's in one)
    e.preventDefault();
    e.stopPropagation();

    // Toggle the confirmation notice
    this.setState({state: STATE_ASK});

    // Set a timeout to hide the confirmation
    this._triggerTimeout = setTimeout(() => {
      this.setState({state: STATE_DEFAULT});
    }, 2000);
  }

  _handleClick (e) {
    const {state} = this.state;
    if (state === STATE_ASK) {
      this._confirm(e)
    } else if (state === STATE_DEFAULT) {
      this._ask(e)
    } else {
      // Do nothing
    }
  }

  componentWillUnmount () {
    clearTimeout(this._triggerTimeout);
    clearTimeout(this._doneTimeout);
  }

  render () {
    const {children, onClick, addIcon, confirmMessage, doneMessage, ...other} = this.props;
    const {state} = this.state;

    const CONFIRM_MESSAGE = confirmMessage || 'Click to confirm';
    const DONE_MESSAGE = doneMessage || 'Done';

    let innerMsg;
    if (state === STATE_ASK && addIcon) {
      innerMsg = (
        <span className="danger">
          <i className="fa fa-exclamation-circle"></i> {CONFIRM_MESSAGE}
        </span>
      )
    } else if (state === STATE_ASK) {
      innerMsg = <span className="danger">{CONFIRM_MESSAGE}</span>
    } else if (state === STATE_DONE) {
      innerMsg = DONE_MESSAGE
    } else {
      innerMsg = children
    }

    return (
      <button onClick={this._handleClick.bind(this)} {...other}>
        {innerMsg}
      </button>
    )
  }
}

PromptButton.propTypes = {
  addIcon: PropTypes.bool,
  confirmMessage: PropTypes.any,
};

export default PromptButton;
