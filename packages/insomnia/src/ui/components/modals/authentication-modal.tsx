import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { forwardRef, ForwardRefRenderFunction, PureComponent } from 'react';
import { useSelector } from 'react-redux';

import { AUTH_BEARER, AuthType, AUTOBIND_CFG, getAuthTypeName } from '../../../common/constants';
import { HandleRender } from '../../../common/render';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { Workspace } from '../../../models/workspace';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { selectActiveWorkspace } from '../../redux/selectors';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from '.';
import { BearerAuth } from './workspace-preferences/bearer-auth';

interface Props extends ModalProps {
  workspace?: Workspace;
  handleRender: HandleRender;
}

interface State {
  type: AuthType;
}

const defaultTypes: AuthType[] = [
  'basic',
  'digest',
  'oauth1',
  'oauth2',
  'ntlm',
  'iam',
  'bearer',
  'hawk',
  'asap',
  'netrc',
  'none',
];

@autoBindMethodsForReact(AUTOBIND_CFG)
class AuthenticationModal extends PureComponent<Props> {
  modal: Modal | null = null;
  workspace = this.props.workspace as Workspace;

  state: State = {
    type: this.workspace?.authentication.type as AuthType,
  };

  _handleSetModalRef(modal: Modal) {
    this.modal = modal;
  }

  _handleSelectType(event: React.SyntheticEvent<HTMLSelectElement>) {
    const type = event.currentTarget.value;
    const authentication = { type, disabled: false };

    this.setState({ type });
    workspaceOperations.update(this.workspace, { authentication });
  }

  show() {
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  renderAuthBody() {
    const { type } = this.state;

    if (type === AUTH_BEARER) {
      return <BearerAuth />;
    }

    return;
  }

  render() {
    const { type } = this.state;

    return (
      <Modal ref={this._handleSetModalRef} freshState>
        <ModalHeader>Manage Authentication</ModalHeader>

        <ModalBody noScroll className="auth-modal">
          <div className="pad">
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  Type
                  <select defaultValue={type} onChange={this._handleSelectType}>
                    {defaultTypes.map(authType => (
                      <option key={authType} value={authType}>
                        {getAuthTypeName(authType, true) || 'No Authentication'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {this.renderAuthBody()}
          </div>
        </ModalBody>

        <ModalFooter>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

const AuthenticationModalFCRF: ForwardRefRenderFunction<AuthenticationModal, Omit<Props, 'handleRender' | 'workspace'>> = (props, ref) => {
  const { handleRender } = useNunjucks();
  const activeWorkspace = useSelector(selectActiveWorkspace);

  return (
    <AuthenticationModal
      ref={ref}
      workspace={activeWorkspace}
      {...props}
      handleRender={handleRender}
    />
  );
};

export const AuthenticationModalFC = forwardRef(AuthenticationModalFCRF);

export const showAuthenticationModal = () => showModal(AuthenticationModal);
