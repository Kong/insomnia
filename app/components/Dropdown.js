import React, {Component, PropTypes} from 'react';

class Dropdown extends Component {
  constructor () {
    super();
    this.state = {open: false};
  }
  
  componentDidMount () {
    // Capture clicks outside the component and close the dropdown
    document.addEventListener('click', (e) => {
      if (!this.refs.container.contains(e.target)) {
        e.preventDefault();
        this.setState({open: false});
      }
    })
  }

  handleClick (e) {
    e.preventDefault();
    this.setState({open: !this.state.open});
  }

  render () {
    const {initialValue, value} = this.props;
    return (
      <div ref="container"
           className={'dropdown ' + (this.state.open ? 'dropdown--open' : '')}
           onClick={this.handleClick.bind(this)}>
        {this.props.children}
      </div>
    )
  }
}

Dropdown.propTypes = {};

export default Dropdown;
