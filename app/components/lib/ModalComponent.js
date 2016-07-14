import React, {Component} from 'react'
import ReactDOM from 'react-dom'


let modals = {
  // Modals will be registered here as singletons
};

class ModalComponent extends Component {
  componentDidMount () {
    const name = this.constructor.name;
    modals[this.constructor.name] = this;
    console.log(`-- Registered ${name} --`)
  }

  static _callInstanceMethod (method, ...args) {
    const name = this.name;
    const instance = modals[name];

    if (!instance) {
      console.error(`Modal doesn't exist with NAME: ${name}`, modals);
      return;
    }

    return instance[method](...args);
  }

  static show (...args) {
    return this._callInstanceMethod('show', ...args);
  }

  static hide (...args) {
    return this._callInstanceMethod('hide', ...args);
  }

  static toggle (...args) {
    return this._callInstanceMethod('toggle', ...args);
  }

  toggle () {
    if (this.refs.modal) {
      this.refs.modal.toggle();
    } else {
      console.error(`ref "modal" does not exist on ${this.constructor.name}`, this.refs);
    }
  }

  hide () {
    if (this.refs.modal) {
      this.refs.modal.hide();
    } else {
      console.error(`ref "modal" does not exist on ${this.constructor.name}`, this.refs);
    }
  }

  show () {
    if (this.refs.modal) {
      this.refs.modal.show();
    } else {
      console.error(`ref "modal" does not exist on ${this.constructor.name}`, this.refs);
    }
  }
}

export default ModalComponent;
