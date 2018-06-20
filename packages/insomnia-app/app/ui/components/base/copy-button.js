// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
const {clipboard} = require('electron');

type Props = {
  content: string | () => Promise<string>,
  children?: React.Node,
  title?: string,
  confirmMessage?: string
}
type State = {
  showConfirmation: boolean
}

@autobind
class CopyButton extends React.PureComponent<Props, State> {
  _triggerTimeout: TimeoutID

  constructor (props: Props) {
    super(props);
    this.state = {
      showConfirmation: false
    };
  }

  async _handleClick (e: SyntheticMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    const content = typeof this.props.content === 'string'
      ? this.props.content
      : await this.props.content();

    if (content) {
      clipboard.writeText(content);
    }

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
  content: PropTypes.oneOfType([
    PropTypes.string.isRequired,
    PropTypes.func.isRequired
  ]).isRequired,

  // Optional
  children: PropTypes.node,
  title: PropTypes.string,
  confirmMessage: PropTypes.string
};

export default CopyButton;
