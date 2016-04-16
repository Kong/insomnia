import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../base/Dropdown'
import * as RequestGroupActions from '../../actions/requestGroups'
import * as db from '../../database'

class RequestGroupActionsDropdown extends Component {
  render () {
    const {actions, requestGroup, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <button>
          <i className="fa fa-caret-down"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => actions.showUpdateNamePrompt(requestGroup)}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button>
              <i className="fa fa-code"></i> Environment
            </button>
          </li>
          <li>
            <button onClick={e => db.remove(requestGroup)}>
              <i className="fa fa-trash-o"></i> Delete
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestGroupActionsDropdown.propTypes = {
  actions: PropTypes.shape({
    update: PropTypes.func.isRequired,
    remove: PropTypes.func.isRequired,
    showUpdateNamePrompt: PropTypes.func.isRequired
  }),
  requestGroup: PropTypes.object
};

function mapStateToProps (state) {
  return {actions: state.actions};
}

function mapDispatchToProps (dispatch) {
  return {
    actions: bindActionCreators(RequestGroupActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestGroupActionsDropdown);
