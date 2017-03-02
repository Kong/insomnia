import React, {PureComponent, PropTypes} from 'react';
import autoBind from 'react-autobind';
const {clipboard} = require('electron');

class CopyButton extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      showConfirmation: false,
    }
    autoBind(this);
  }

  _handleClick (e) {
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
