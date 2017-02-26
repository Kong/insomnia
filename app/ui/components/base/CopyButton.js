import React, {Component, PropTypes} from 'react';
const {clipboard} = require('electron');

class CopyButton extends Component {
  state = {showConfirmation: false};

  _handleClick = e => {
    e.preventDefault();
    e.stopPropagation();

    clipboard.writeText(this.props.content);

    this.setState({showConfirmation: true});

    this._triggerTimeout = setTimeout(() => {
      this.setState({showConfirmation: false});
    }, 2000);
  };

  componentWillUnmount () {
    clearTimeout(this._triggerTimeout);
  }

  render () {
    const {content, children, ...other} = this.props;
    const {showConfirmation} = this.state;

    return (
      <button {...other} onClick={this._handleClick}>
        {showConfirmation ?
          <span>Copied <i className="fa fa-check-circle-o"/></span> :
          (children || 'Copy to Clipboard')
        }
      </button>
    )
  }
}

CopyButton.propTypes = {
  content: PropTypes.string.isRequired
};

export default CopyButton;
