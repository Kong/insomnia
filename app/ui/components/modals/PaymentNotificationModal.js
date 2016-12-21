import React, {Component} from 'react';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import {trackEvent} from '../../../analytics';


let hidePaymentNotificationUntilNextLaunch = false;

class PaymentNotificationModal extends Component {
  _handleHide = () => {
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
        <ModalHeader>Free Trial has Ended</ModalHeader>
        <ModalBody className="pad changelog">
          <div className="text-center pad">
            <h1>
              Hi {session.getFirstName()},
            </h1>
            <p style={{maxWidth: '30rem', margin: 'auto'}}>
              Your Insomnia Plus trial has ended. please enter your billing information to
              continue using your account.
            </p>
            <br/>
            <p className="pad-top">
              <Link button={true} href="https://insomnia.rest/app/subscribe/" className="btn btn--compact btn--outlined">
                Enter Billing Info
              </Link>
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={this._handleHide}>
            Maybe Later
          </button>
          &nbsp;
        </ModalFooter>
      </Modal>
    )
  }
}

PaymentNotificationModal.propTypes = {};

export default PaymentNotificationModal;
