import React, {Component, PropTypes} from 'react'
import ReactDOM from 'react-dom'
import classnames from 'classnames'

import Mousetrap from '../../lib/mousetrap'

class Modal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false
    }
  }

  _handleClick(e) {
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;
    let shouldHide = false;

    if (target === this.refs.modal) {
      shouldHide = true;
    }

    for (let i = 0; i < 5; i++) {
      if (target.hasAttribute('data-close-modal')) {
        shouldHide = true;
        break;
      }

      target = target.parentNode;
    }

    if (shouldHide) {
      this.hide();
    }
  }

  show() {
    this.setState({open: true});
    this.focus();
    
    Mousetrap.bind('esc', () => {
      this.hide();
    });
  }

  toggle() {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  hide() {
    this.setState({open: false});

    // Focus the app when the modal closes
    // TODO: Is this the best thing to do here? Maybe we should focus the last thing
    document.getElementById('wrapper').focus();
    
    // Unbind keys
    Mousetrap.unbind('esc');
  }

  focus() {
    const node = ReactDOM.findDOMNode(this);
    node && node.focus();
  }

  render() {
    return (
      <div
        tabIndex="-1"
        className={classnames('modal', this.props.className, {'modal--open': this.state.open})}
        onClick={this._handleClick.bind(this)}>

        <div className={classnames('modal__content', {tall: this.props.tall})}>
          <div className="modal__backdrop" onClick={() => this.hide()}></div>
          {this.props.children}
        </div>
      </div>
    )
  }
}

Modal.propTypes = {
  tall: PropTypes.bool
};

export default Modal;

