import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../components/base/Dropdown'
import * as RequestActions from '../redux/modules/requests'
import * as db from '../database';

class RequestActionsDropdown extends Component {
  render () {
    const {actions, request, ...other} = this.props;

    return (
      <Dropdown {...other}>
        <button>
          <i className="fa fa-gear"></i>
        </button>
        <ul>
          <li>
            <button onClick={e => db.requestCopy(request)}>
              <i className="fa fa-copy"></i> Duplicate
            </button>
          </li>
          <li>
            <button onClick={e => actions.showUpdateNamePrompt(request)}>
              <i className="fa fa-edit"></i> Rename
            </button>
          </li>
          <li>
            <button>
              <i className="fa fa-share-square-o"></i> Export
            </button>
          </li>
          <li>
            <button onClick={e => db.remove(request)}>
              <i className="fa fa-trash-o"></i> Delete
            </button>
          </li>
        </ul>
      </Dropdown>
    )
  }
}

RequestActionsDropdown.propTypes = {
  request: PropTypes.object.isRequired,
  actions: PropTypes.shape({
    showUpdateNamePrompt: PropTypes.func.isRequired
  })
};

function mapStateToProps (state) {
  return {
    actions: state.actions
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: bindActionCreators(RequestActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RequestActionsDropdown);
