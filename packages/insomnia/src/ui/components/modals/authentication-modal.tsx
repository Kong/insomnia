import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { forwardRef, ForwardRefRenderFunction, PureComponent } from 'react';
import { useSelector } from 'react-redux';

import {
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AuthType,
  AUTOBIND_CFG,
} from '../../../common/constants';
import { WorkspaceAuthentication } from '../../../models/workspace';
import { selectActiveWorkspace } from '../../redux/selectors';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from '.';
import {
  AsapAuth,
  AuthSelectType,
  AWSAuth,
  BasicAuth,
  BearerAuth,
  DigestAuth,
  HawkAuth,
  NetrcAuth,
  NTLMAuth,
  OAuth1Auth,
} from './workspace-management';

interface Props extends ModalProps {
  authentication?: WorkspaceAuthentication;
}

interface State {
  type: AuthType;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class AuthenticationModal extends PureComponent<Props> {
  modal: Modal | null = null;
  authentication = this.props.authentication;

  state: State = {
    type: this.authentication?.type || 'none',
  };

  _handleSetModalRef(modal: Modal) {
    this.modal = modal;
  }

  _handleChangeType(type: string) {
    this.setState({ type });
  }

  show() {
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  renderAuthBody() {
    const { type } = this.state;

    if (type === AUTH_BASIC) {
      return <BasicAuth />;
    } else if (type === AUTH_HAWK) {
      return <HawkAuth />;
    } else if (type === AUTH_OAUTH_1) {
      return <OAuth1Auth />;
    } else if (type === AUTH_BEARER) {
      return <BearerAuth />;
    } else if (type === AUTH_DIGEST) {
      return <DigestAuth />;
    } else if (type === AUTH_NTLM) {
      return <NTLMAuth />;
    } else if (type === AUTH_AWS_IAM) {
      return <AWSAuth />;
    } else if (type === AUTH_NETRC) {
      return <NetrcAuth />;
    } else if (type === AUTH_ASAP) {
      return <AsapAuth />;
    }

    return;
  }

  render() {
    return (
      <Modal ref={this._handleSetModalRef} freshState>
        <ModalHeader>Manage Authentication</ModalHeader>

        <ModalBody className="auth-modal">
          <div className="pad">
            <AuthSelectType changeType={this._handleChangeType} />

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

const AuthenticationModalFCRF: ForwardRefRenderFunction<AuthenticationModal, Omit<Props, 'authentication'>> = (props, ref) => {
  const activeWorkspace = useSelector(selectActiveWorkspace);

  return (
    <AuthenticationModal
      ref={ref}
      authentication={activeWorkspace?.authentication}
      {...props}
    />
  );
};

export const AuthenticationModalFC = forwardRef(AuthenticationModalFCRF);

export const showAuthenticationModal = () => showModal(AuthenticationModal);
