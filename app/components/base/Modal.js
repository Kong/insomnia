import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';


class Modal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false
    };
  }

  _handleClick (e) {
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;
    let shouldHide = false;

    if (target === ReactDOM.findDOMNode(this)) {
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
    setTimeout(() => {
      this._node.focus();
    });
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
  }

  componentDidMount () {
    // In order for this to work, there needs to be tabIndex of -1 on the modal container
    ReactDOM.findDOMNode(this).addEventListener('keydown', e => {
      if (this.state.open && e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        // Pressed escape
        this.hide();
      }
    });
  }

  render () {
    const {tall, top, wide, className} = this.props;
    const {open} = this.state;

    const classes = classnames(
      'modal',
      className,
      {'modal--open': open},
      {'modal--fixed-height': tall},
      {'modal--fixed-top': top},
      {'modal--wide': wide}
    );

    return (
      <div ref={n => this._node = n} tabIndex="-1" className={classes} onClick={this._handleClick.bind(this)}>
        <div className="modal__content">
          <div className="modal__backdrop" onClick={() => this.hide()}></div>
          {this.props.children}
        </div>
      </div>
    )
  }
}

Modal.propTypes = {
  tall: PropTypes.bool,
  top: PropTypes.bool,
  wide: PropTypes.bool
};

export default Modal;

