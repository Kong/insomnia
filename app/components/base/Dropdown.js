import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';

class Dropdown extends Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false,
      dropUp: false
    };
  }

  _handleClick () {
    this.toggle();
  }

  hide () {
    this.setState({open: false});
  }

  show () {
    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = ReactDOM.findDOMNode(this).getBoundingClientRect().top;
    const dropUp = dropdownTop > bodyHeight * 0.65;

    this.setState({open: true, dropUp});
  }

  toggle () {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  componentDidMount () {
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
    const {right, className, outline} = this.props;
    const {dropUp, open} = this.state;

    const classes = classnames(
      'dropdown',
      className,
      {'dropdown--open': open},
      {'dropdown--outlined': outline},
      {'dropdown--up': dropUp},
      {'dropdown--right': right}
    );

    return (
      <div className={classes}
           onClick={this._handleClick.bind(this)}>

        {this.props.children}
        <div className="dropdown__backdrop"></div>
      </div>
    )
  }
}

Dropdown.propTypes = {
  right: PropTypes.bool,
  outline: PropTypes.bool
};

export default Dropdown;
