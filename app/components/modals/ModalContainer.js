import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import * as ModalActions from '../../actions/modals'
import * as RequestGroupActions from '../../actions/requestGroups'
import * as RequestActions from '../../actions/requests'
import * as modalIds from '../../constants/modals'
import PromptModal from '../base/PromptModal'
import EnvironmentEditModal from './EnvironmentEditModal'

class Modals extends Component {
  constructor (props) {
    super(props);
    this._modals = [
      EnvironmentEditModal
    ];
    this._prompts = {};
    this._prompts[modalIds.REQUEST_RENAME] = {
      header: 'Rename Request',
      submit: 'Rename',
      onSubmit: (modal, name) => {
        props.actions.updateRequest({id: modal.data.id, name})
      }
    };

    this._prompts[modalIds.REQUEST_GROUP_RENAME] = {
      header: 'Rename Request Group',
      submit: 'Rename',
      onSubmit: (modal, name) => {
        props.actions.updateRequestGroup({id: modal.data.id, name})
      }
    };
  }

  render () {
    const {modals, actions} = this.props;

    return (
      <div>
        <div ref="prompts">
          {Object.keys(this._prompts).map(id => {
            const promptDef = this._prompts[id];
            const modal = modals.find(m => m.id === id);

            if (!modal) {
              return null;
            }

            return (
              <PromptModal
                key={id}
                headerName={promptDef.header}
                submitName={promptDef.submit}
                defaultValue={modal.data.defaultValue}
                onClose={() => actions.hideModal(modal.id)}
                onSubmit={value => promptDef.onSubmit(modal, value)}
              />
            )
          })}
        </div>
        <div ref="modals">
          {this._modals.map(c => {
            const id = c.defaultProps.id;
            const isVisible = modals.find(m => m.id === id);
            const modal = React.createElement(c, {
              key: id,
              onClose: () => actions.hideModal(id)
            });
            return isVisible ? modal : null;
          })}
        </div>
        <div ref="toasts">
          {/*<div className="toast grid">
            <div className="toast__message">Request deleted</div>
            <button className="btn toast__action">
              Undo
            </button>
          </div> */}
        </div>
      </div>
    );
  }
}

Modals.propTypes = {
  actions: PropTypes.shape({
    hideModal: PropTypes.func.isRequired,
    updateRequestGroup: PropTypes.func.isRequired,
    updateRequest: PropTypes.func.isRequired
  }),
  modals: PropTypes.array.isRequired
};

function mapStateToProps (state) {
  return {
    actions: state.actions,
    modals: state.modals
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: Object.assign(
      {},
      bindActionCreators(ModalActions, dispatch),
      bindActionCreators(RequestGroupActions, dispatch),
      bindActionCreators(RequestActions, dispatch)
    )
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Modals);

