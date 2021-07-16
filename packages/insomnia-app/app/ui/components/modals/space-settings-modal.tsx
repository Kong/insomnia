import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import DebouncedInput from '../base/debounced-input';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import PromptButton from '../base/prompt-button';
import * as models from '../../../models/index';
import { isBaseSpace, isRemoteSpace } from '../../../models/space';
import { strings } from '../../../common/strings';
import { selectActiveSpace } from '../../redux/selectors';
import { bindActionCreators } from 'redux';
import * as spaceActions from '../../redux/modules/space';
import { connect } from 'react-redux';
import { RootState } from '../../redux/modules';

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
    if (isBaseSpace(space) || isRemoteSpace(space)) {
      return null;
    }

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
              <DebouncedInput
              // @ts-expect-error -- TSCONVERSION props are spread into an input element
                type="text"
                delay={500}
                placeholder="My Space"
                defaultValue={space.name}
                onChange={this._handleRename}
              />
            </label>
          </div>
          <h2>Actions</h2>
          <div className="form-control form-control--padded">
            <PromptButton
              onClick={this._handleRemoveSpace}
              addIcon
              className="width-auto btn btn--clicky inline-block">
              <i className="fa fa-trash-o" /> Delete
            </PromptButton>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => {
  const space = selectActiveSpace(state);
  return { space };
};

const mapDispatchToProps = dispatch => {
  const boundSpaceActions = bindActionCreators(spaceActions, dispatch);
  return {
    handleRemoveSpace: boundSpaceActions.removeSpace,
  };
};

export default connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(SpaceSettingsModal);
