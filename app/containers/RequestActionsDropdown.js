import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux'
import Dropdown from '../components/base/Dropdown';
import DropdownHint from '../components/base/DropdownHint';
import GenerateCodeModal from '../components/modals/GenerateCodeModal';
import PromptModal from '../components/modals/PromptModal';
import * as db from '../database';
import {getModal} from '../components/modals/index';


class RequestActionsDropdown extends Component {
  _promptUpdateName () {
    const {request} = this.props;

    getModal(PromptModal).show({
      headerName: 'Rename Request',
      defaultValue: request.name,
      hint: 'also rename requests by double clicking in the sidebar'
    }).then(name => {
      db.requestUpdate(request, {name});
    })
  }

  render () {
    const {request, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <button>
          <i className="fa fa-caret-down"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => db.requestDuplicate(request)}>
              <i className="fa fa-copy"></i> Duplicate
              <DropdownHint char="D"></DropdownHint>
            </button>
          </li>
          <li>
            <button onClick={e => this._promptUpdateName()}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button onClick={e => getModal(GenerateCodeModal).show(request)}>
              <i className="fa fa-code"></i> Generate Code
            </button>
          </li>
          <li>
            <button onClick={e => db.requestRemove(request)}>
              <i className="fa fa-trash-o"></i> Delete
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  request: PropTypes.object.isRequired
};

function mapStateToProps (state) {
  return {};
}

function mapDispatchToProps (dispatch) {
  return {}
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestActionsDropdown);
