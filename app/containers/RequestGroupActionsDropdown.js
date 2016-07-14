import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import Dropdown from '../components/base/Dropdown'
import EnvironmentEditModal from '../components/EnvironmentEditModal'
import PromptModal from '../components/PromptModal'
import * as db from '../database'

class RequestGroupActionsDropdown extends Component {
  _promptUpdateName () {
    const {requestGroup} = this.props;

    PromptModal.show({
      headerName: 'Rename Request Group',
      defaultValue: requestGroup.name
    }).then(name => {
      db.requestGroupUpdate(requestGroup, {name});
    })
  }
  render () {
    const {requestGroup, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <button>
          <i className="fa fa-caret-down"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => this._promptUpdateName()}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button onClick={e => EnvironmentEditModal.show()}>
              <i className="fa fa-code"></i> Environment
            </button>
          </li>
          <li>
            <button onClick={e => db.requestGroupRemove(requestGroup)}>
              <i className="fa fa-trash-o"></i> Delete
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestGroupActionsDropdown.propTypes = {
  requestGroup: PropTypes.object
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
)(RequestGroupActionsDropdown);
