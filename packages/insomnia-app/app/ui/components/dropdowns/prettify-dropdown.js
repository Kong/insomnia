import * as React from 'react';
import autobind from 'autobind-decorator';
import PropTypes from 'prop-types';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';

@autobind
class PrettifyDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      autoPrettify: this.props.autoPrettify,
    };
  }

  _handleChange(autoPrettify) {
    this.props.onChange(autoPrettify);
    this.setState({
      autoPrettify,
    });
  }

  render() {
    return (
      <Dropdown beside debug="true">
        <DropdownButton>
          <i className="fa fa-cog" />
        </DropdownButton>
        <DropdownDivider>Beautify mode</DropdownDivider>
        <DropdownItem onClick={this._handleChange} value={true}>
          {this.state.autoPrettify ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
          Auto
        </DropdownItem>
        <DropdownItem onClick={this._handleChange} value={false}>
          {!this.state.autoPrettify ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
          Manual
        </DropdownItem>
      </Dropdown>
    );
  }
}

PrettifyDropdown.propTypes = {
  autoPrettify: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default PrettifyDropdown;
