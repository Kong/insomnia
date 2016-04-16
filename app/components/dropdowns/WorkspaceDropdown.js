import React, {Component, PropTypes} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import Dropdown from '../base/Dropdown'
import * as RequestGroupActions from '../../actions/requestGroups'
import * as db from '../../database'

class WorkspaceDropdown extends Component {
  render () {
    const {actions, loading, ...other} = this.props;

    return (
      <Dropdown right={true} {...other} className="block">
        <button className="btn header__content">
          <div className="grid grid--center">
            <div className="grid__cell">
              <h1 className="no-pad">Insomnia</h1>
            </div>
            <div className="no-wrap">
              {loading ? <i className="fa fa-refresh fa-spin txt-lg"></i> : ''}&nbsp;
              <i className="fa fa-caret-down txt-lg"></i>
            </div>
          </div>
        </button>
        <ul>
          <li><button onClick={e => db.requestCreate()}>
            <i className="fa fa-plus-circle"></i> Add Request
          </button></li>
          <li><button onClick={e => db.requestGroupCreate()}>
            <i className="fa fa-folder"></i> Add Request Group
          </button></li>
          <li><button onClick={e => actions.showEnvironmentEditModal()}>
            <i className="fa fa-code"></i> Environments
          </button></li>
          <li><button><i className="fa fa-share-square-o"></i> Import/Export</button></li>
          <li><button><i className="fa fa-empty"></i> Toggle Sidebar</button></li>
          <li><button><i className="fa fa-empty"></i> Delete Workspace</button></li>
        </ul>
      </Dropdown>
    )
  }
}

WorkspaceDropdown.propTypes = {
  loading: PropTypes.bool.isRequired,
  actions: PropTypes.shape({
    showEnvironmentEditModal: PropTypes.func.isRequired
  })
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    loading: state.loading
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: bindActionCreators(RequestGroupActions, dispatch)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkspaceDropdown);
