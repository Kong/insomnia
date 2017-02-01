import React, {Component} from 'react';
import PromptButton from '../base/PromptButton';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import {trackEvent} from '../../../analytics';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';


let hidePaymentNotificationUntilNextLaunch = false;

class PaymentNotificationModal extends Component {
  _handleCancel = async () => {
    await sync.cancelTrial();
    this.hide();
  };

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
      <Modal ref={m => this.modal = m}>
        <ModalHeader>Insomnia Plus Trial Ended</ModalHeader>
        <ModalBody className="pad changelog">
          <div className="text-center pad">
            <h1>Hi {session.getFirstName()},</h1>
            <p style={{maxWidth: '30rem', margin: 'auto'}}>
              Your Insomnia Plus trial has come to an end. Please subscribe to a plan
              to continue using Plus features like encrypted data synchronization and backup.
            </p>
            <br/>
            <p className="pad-top">
              <PromptButton onClick={this._handleCancel} className="btn btn--compact faint">
                End Subscription
              </PromptButton>
              {" "}
              <Link button={true}
                    href="https://insomnia.rest/app/subscribe/"
                    className="btn btn--compact btn--outlined">
                Subscribe Now
              </Link>
            </p>
          </div>
        </ModalBody>
      </Modal>
    )
  }
}

PaymentNotificationModal.propTypes = {};

export default PaymentNotificationModal;
