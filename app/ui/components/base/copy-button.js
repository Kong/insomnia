import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
const {clipboard} = require('electron');

@autobind
class CopyButton extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      showConfirmation: false
    };
  }

  _handleClick (e) {
    e.preventDefault();
    e.stopPropagation();

    clipboard.writeText(this.props.content);

    this.setState({showConfirmation: true});

    this._triggerTimeout = setTimeout(() => {
      this.setState({showConfirmation: false});
    }, 2000);
  }

  componentWillUnmount () {
    clearTimeout(this._triggerTimeout);
  }

  render () {
    const {
      content, // eslint-disable-line no-unused-vars
      children,
      title,
      confirmMessage,
      ...other
    } = this.props;
    const {showConfirmation} = this.state;

    const confirm = typeof confirmMessage === 'string' ? confirmMessage : 'Copied';

    return (
      <button {...other} title={title} onClick={this._handleClick}>
        {showConfirmation
          ? <span>{confirm} <i className="fa fa-check-circle-o"/></span>
          : (children || 'Copy to Clipboard')
        }
      </button>
    );
  }
}

CopyButton.propTypes = {
  // Required
  content: PropTypes.string.isRequired,

  // Optional
  children: PropTypes.node,
  title: PropTypes.string,
  confirmMessage: PropTypes.string
};

export default CopyButton;
