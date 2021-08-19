import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { strings } from '../../../common/strings';
import * as models from '../../../models/index';
import { isRemoteProject, projectHasSettings } from '../../../models/project';
import { RootState } from '../../redux/modules';
import * as projectActions from '../../redux/modules/project';
import { selectActiveProject } from '../../redux/selectors';
import DebouncedInput from '../base/debounced-input';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import PromptButton from '../base/prompt-button';
import HelpTooltip from '../help-tooltip';

export type ReduxProps = ReturnType<typeof mapStateToProps> & ReturnType<typeof mapDispatchToProps>;

type Props = ReduxProps

@autoBindMethodsForReact(AUTOBIND_CFG)
class SpaceSettingsModal extends PureComponent<Props> {
  modal: Modal | null = null;

  _handleSetModalRef(n: Modal) {
    this.modal = n;
  }

  _handleRemoveSpace() {
    this.props.handleRemoveSpace(this.props.space);
    this.hide();
  }

  async _handleRename(name: string) {
    const { space } = this.props;
    await models.space.update(space, { name });
  }

  show() {
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { space } = this.props;
    if (!projectHasSettings(space)) {
      return null;
    }

    const isRemote = isRemoteProject(space);

    return (
      <Modal ref={this._handleSetModalRef} freshState>
        <ModalHeader key={`header::${space._id}`}>
          {strings.space.singular} Settings{' '}
          <div className="txt-sm selectable faint monospace">{space._id}</div>
        </ModalHeader>
        <ModalBody key={`body::${space._id}`} className="pad">
          <div className="form-control form-control--outlined">
            <label>
              Name
              {isRemote && (
                <>
                  <HelpTooltip className="space-left">
                    To rename a {strings.remoteSpace.singular.toLowerCase()} {strings.space.singular.toLowerCase()} please visit <a href="https://app.insomnia.rest/app/teams">the insomnia website.</a>
                  </HelpTooltip>
                  <input disabled readOnly defaultValue={space.name} />
                </>
              )}
              {!isRemote && (
                <DebouncedInput
                // @ts-expect-error -- TSCONVERSION props are spread into an input element
                  type="text"
                  delay={500}
                  placeholder={`My ${strings.space.singular}`}
                  defaultValue={space.name}
                  onChange={this._handleRename}
                />
              )}
            </label>
          </div>
          <h2>Actions</h2>
          <div className="form-control form-control--padded">
            <PromptButton
              onClick={this._handleRemoveSpace}
              addIcon
              className="width-auto btn btn--clicky inline-block"
            >
              <i className="fa fa-trash-o" /> Delete
            </PromptButton>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => {
  const space = selectActiveProject(state);
  return { space };
};

const mapDispatchToProps = dispatch => {
  const boundSpaceActions = bindActionCreators(projectActions, dispatch);
  return {
    handleRemoveSpace: boundSpaceActions.removeSpace,
  };
};

export default connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(SpaceSettingsModal);
