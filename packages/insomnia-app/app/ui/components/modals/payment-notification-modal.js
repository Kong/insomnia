import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import PromptButton from '../base/prompt-button';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import {trackEvent} from '../../../common/analytics';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';

let hidePaymentNotificationUntilNextLaunch = false;

@autobind
class PaymentNotificationModal extends PureComponent {
  async _handleCancel () {
    await sync.cancelTrial();
    this.hide();
  }

  _setModalRef (n) {
    this.modal = n;
  }

  show () {
    // Don't trigger automatically if user has dismissed it already
    if (hidePaymentNotificationUntilNextLaunch) {
      return;
    }

    hidePaymentNotificationUntilNextLaunch = true;
    this.modal.show();
  }

  hide () {
    trackEvent('Billing', 'Trial Ended', 'Cancel');
    this.modal.hide();
  }

  render () {
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Insomnia Plus Trial Ended</ModalHeader>
        <ModalBody className="pad changelog">
          <div className="text-center pad">
            <h1>Hi {session.getFirstName()},</h1>
            <p style={{maxWidth: '30rem', margin: 'auto'}}>
              Your Insomnia Plus trial has come to an end. Please enter your billing info
              to continue using Plus features like encrypted data synchronization and backup.
            </p>
            <br/>
            <p className="pad-top">
              <PromptButton onClick={this._handleCancel} className="btn btn--compact faint">
                Cancel Subscription
              </PromptButton>
              &nbsp;&nbsp;
              <Link button
                    href="https://insomnia.rest/app/subscribe/"
                    className="btn btn--compact btn--outlined">
                Update Billing
              </Link>
            </p>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

export default PaymentNotificationModal;
