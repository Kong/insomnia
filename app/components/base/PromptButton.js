import React, {Component, PropTypes} from 'react';

class PromptButton extends Component {
  constructor (props) {
    super(props);
    this.state = {
      showConfirmation: false
    }
  }

  _confirm (e) {
    // Clear existing timeouts
    clearTimeout(this._timeout);

    // Reset the state
    this.setState({showConfirmation: false});

    // Fire the click handler
    this.props.onClick(e);
  }

  _toggle (e) {
    // Prevent events (ex. won't close dropdown if it's in one)
    e.preventDefault();
    e.stopPropagation();

    // Toggle the confirmation notice
    this.setState({showConfirmation: true});

    // Set a timeout to hide the confirmation
    this._timeout = setTimeout(() => {
      this.setState({showConfirmation: false});
    }, 2000);
  }

  _handleClick (e) {
    if (this.state.showConfirmation) {
      this._confirm(e)
    } else {
      this._toggle(e)
    }
  }

  componentWillUnmount () {
    clearTimeout(this._timeout);
  }

  render () {
    const {children, onClick, addIcon, ...other} = this.props;
    const {showConfirmation} = this.state;

    const CONFIRM_MESSAGE = 'Click to confirm';

    let innerMsg;
    if (showConfirmation && addIcon) {
      innerMsg = (
        <span className="danger">
          <i className="fa fa-exclamation-circle"></i> {CONFIRM_MESSAGE}
        </span>
      )
    } else if (showConfirmation) {
      innerMsg = <span className="danger">{CONFIRM_MESSAGE}</span>
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
  addIcon: PropTypes.bool
};

export default PromptButton;
