import React, {Component, PropTypes} from 'react';
const {clipboard} = require('electron');

class CopyButton extends Component {
  constructor (props) {
    super(props);
    this.state = {
      showConfirmation: false
    }
  }
  _handleClick (e) {
    e.preventDefault();

    clipboard.writeText(this.props.content);

    this.setState({showConfirmation: true});

    this._timeout = setTimeout(() => {
      this.setState({showConfirmation: false});
    }, 2000);
  }

  componentWillUnmount() {
    clearTimeout(this._timeout);
  }

  render () {
    const {content, ...other} = this.props;
    const {showConfirmation} = this.state;

    return (
      <button onClick={this._handleClick.bind(this)} {...other}>
        {showConfirmation ? 'Copied' : 'Copy'}
      </button>
    )
  }
}

CopyButton.propTypes = {
  content: PropTypes.string.isRequired
};

export default CopyButton;
