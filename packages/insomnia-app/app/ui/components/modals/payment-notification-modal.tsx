import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { endTrial, getFirstName, logout } from '../../../account/session';
import { AUTOBIND_CFG } from '../../../common/constants';
import { Link } from '../base/link';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
let hidePaymentNotificationUntilNextLaunch = false;

@autoBindMethodsForReact(AUTOBIND_CFG)
export class PaymentNotificationModal extends PureComponent {
  async _handleCancel() {
    try {
      await endTrial();
      await logout();
    } catch (err) {
      // That's okay
    }

    this.hide();
  }

  modal: Modal | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  show() {
    // Don't trigger automatically if user has dismissed it already
    if (hidePaymentNotificationUntilNextLaunch) {
      return;
    }

    hidePaymentNotificationUntilNextLaunch = true;
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Insomnia Plus Trial Ended</ModalHeader>
        <ModalBody className="pad changelog">
          <div className="text-center pad">
            <h1>Hi {getFirstName()},</h1>
            <p
              style={{
                maxWidth: '30rem',
                margin: 'auto',
              }}
            >
              Your Insomnia Plus trial has come to an end. Please enter your billing info to
              continue using Plus features like encrypted data synchronization and backup.
            </p>
            <br />
            <p className="pad-top">
              <PromptButton onClick={this._handleCancel} className="btn btn--compact faint">
                Cancel Subscription
              </PromptButton>
              &nbsp;&nbsp;
              <Link
                button
                href="https://app.insomnia.rest/app/subscribe/"
                className="btn btn--compact btn--outlined"
              >
                Update Billing
              </Link>
            </p>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}
