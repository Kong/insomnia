import React, {Component, PropTypes} from 'react'
import ReactDOM from 'react-dom'
import {HotKeys} from 'react-hotkeys'
import classnames from 'classnames'

class Modal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false
    }
  }

  _handleClick (e) {
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

  show () {
    this.setState({open: true});
    this.focus();
  }

  hide () {
    this.setState({open: false});
  }
  
  toggle () {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  hide () {
    this.setState({open: false});

    // Focus the app when the modal closes
    // TODO: Is this the best thing to do here? Maybe we should focus the last thing
    document.getElementById('wrapper').focus();
  }

  focus () {
    const node = ReactDOM.findDOMNode(this);
    node && node.focus();
  }

  render () {
    return (
      <HotKeys
        handlers={{escape: () => this.hide()}}
        className={classnames('modal', this.props.className, {'modal--open': this.state.open})}
        onClick={this._handleClick.bind(this)}>
        
        <div className={classnames('modal__content', {tall: this.props.tall})}>
          <div className="modal__backdrop" onClick={() => this.hide()}></div>
          {this.props.children}
        </div>
      </HotKeys>
    )
  }
}

Modal.propTypes = {
  tall: PropTypes.bool
};

export default Modal;

