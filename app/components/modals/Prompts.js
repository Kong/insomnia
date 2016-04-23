import React, {Component, PropTypes} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import * as ModalActions from '../../modules/modals'
import * as RequestGroupActions from '../../modules/requestGroups'
import * as RequestActions from '../../modules/requests'
import PromptModal from '../base/PromptModal'

import * as db from '../../database'
import {MODAL_REQUEST_RENAME, MODAL_REQUEST_GROUP_RENAME} from '../../lib/constants';

class Prompts extends Component {
  constructor (props) {
    super(props);
    this._prompts = {};
    this._prompts[MODAL_REQUEST_RENAME] = {
      header: 'Rename Request',
      submit: 'Rename',
      onSubmit: (modal, name) => {
        db.update(modal.data.request, {name})
      }
    };

    this._prompts[MODAL_REQUEST_GROUP_RENAME] = {
      header: 'Rename Request Group',
      submit: 'Rename',
      onSubmit: (modal, name) => {
        db.update(modal.data.requestGroup, {name})
      }
    };
  }

  render () {
    const {modals, actions} = this.props;

    return (
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
              id={id}
              headerName={promptDef.header}
              submitName={promptDef.submit}
              defaultValue={modal.data.defaultValue}
              onClose={() => actions.modals.hide(modal.id)}
              onSubmit={value => promptDef.onSubmit(modal, value)}
            />
          )
        })}
      </div>
    );
  }
}

Prompts.propTypes = {
  actions: PropTypes.shape({
    modals: PropTypes.shape({
      hide: PropTypes.func.isRequired
    }),
    requestGroups: PropTypes.shape({
      update: PropTypes.func.isRequired
    }),
    requests: PropTypes.shape({
      update: PropTypes.func.isRequired
    })
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
    actions: {
      requests: bindActionCreators(RequestActions, dispatch),
      modals: bindActionCreators(ModalActions, dispatch),
      requestGroups: bindActionCreators(RequestGroupActions, dispatch)
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Prompts);

