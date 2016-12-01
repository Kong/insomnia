import React, {Component} from 'react';
import Link from '../base/Link';
import Nl2Br from '../Nl2Br';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import AlertModal from './AlertModal';
import {showModal} from './index';

const MONTHS = [
  {name: 'January', value: '01'},
  {name: 'February', value: '02'},
  {name: 'March', value: '03'},
  {name: 'April', value: '04'},
  {name: 'May', value: '05'},
  {name: 'June', value: '06'},
  {name: 'July', value: '07'},
  {name: 'August', value: '08'},
  {name: 'September', value: '09'},
  {name: 'October', value: '10'},
  {name: 'November', value: '11'},
  {name: 'December', value: '12'},
];

const YEARS = [];
for (let i = 0; i < 20; i++) {
  YEARS.push(2016 + i);
}

class PaymentModal extends Component {
  state = {
    title: '',
    message: '',
    error: '',
    loading: false,
    cardType: '',
    selectedPlan: 'plus-monthly-1'
  };

  show (options = {}) {
    const {message, title} = options;
    this.setState({error: '', message, title});
    this.modal.show();
    setTimeout(() => this._nameInput.focus(), 100);
  }

  hide () {
    this.modal.hide();
  }

  _handlePlanChange (selectedPlan) {
    this.setState({selectedPlan});
  }

  _handleCreditCardCvcChange (e) {
    const value = e.target.value.trim();
    if (!value) {
      return;
    }

    e.target.value = value.replace(/[^0-9]/g, '').trim()
  }

  _handleCreditCardNumberChange (e) {
    const value = e.target.value.trim();
    if (!value) {
      return;
    }

    const cardType = Stripe.card.cardType(value);
    const lastChar = value[e.target.value.length - 1];
    const num = value.replace(/[^0-9]*/g, '');
    let newNum = '';

    if (cardType === 'American Express') {
      // 1111 222222 33333
      const g1 = num.slice(0, 4);
      const g2 = num.slice(4, 10);
      const g3 = num.slice(10, 15);

      newNum = g1;
      newNum += g2 ? ` ${g2}` : '';
      newNum += g3 ? ` ${g3}` : '';
    } else if (cardType === 'Diners Club') {
      // 1111 2222 3333 44
      const g1 = num.slice(0, 4);
      const g2 = num.slice(4, 8);
      const g3 = num.slice(8, 12);
      const g4 = num.slice(12, 14);

      newNum = g1;
      newNum += g2 ? ` ${g2}` : '';
      newNum += g3 ? ` ${g3}` : '';
      newNum += g4 ? ` ${g4}` : '';
    } else {
      // 1111 2222 3333 4444
      const g1 = num.slice(0, 4);
      const g2 = num.slice(4, 8);
      const g3 = num.slice(8, 12);
      const g4 = num.slice(12, 16);

      newNum = g1;
      newNum += g2 ? ` ${g2}` : '';
      newNum += g3 ? ` ${g3}` : '';
      newNum += g4 ? ` ${g4}` : '';
    }

    // Handle trailing dash so we can add and delete dashes properly
    if (lastChar === ' ') {
      newNum += ' ';
    }

    this.setState({cardType: cardType === 'Unknown' ? '' : cardType});

    // Only update number if it changed from the user's original to prevent cursor jump
    if (newNum !== value) {
      e.target.value = newNum;
    }
  }

  _handleSubmit (e) {
    e.preventDefault();

    this.setState({error: '', loading: true});

    const params = {
      name: this._nameInput.value,
      number: this._cardNumberInput.value.replace(/ /g, ''),
      cvc: this._cvcInput.value,
      exp_month: parseInt(this._expiryMonthInput.value, 10),
      exp_year: parseInt(this._expiryYearInput.value, 10),
    };

    Stripe.card.createToken(params, async (status, response) => {
      if (status === 200) {
        try {
          await session.subscribe(response.id, this.state.selectedPlan);
          this.setState({error: '', loading: false});
          showModal(AlertModal, {
            title: 'Payment Succeeded',
            message: 'Thanks for supporting Insomnia! You may now continue using the app.'
          });
          this.hide();
        } catch (e) {
          this.setState({error: e.message, loading: false});
        }
      } else {
        this.setState({error: response.error.message, loading: false});
      }
    });
  }

  render () {
    const {selectedPlan, cardType, message, title} = this.state;

    return (
      <form onSubmit={this._handleSubmit.bind(this)}
            key={session.getCurrentSessionId()}>
        <Modal ref={m => this.modal = m} {...this.props}>
          <ModalHeader>{title || "Enter Payment Method"}</ModalHeader>
          <ModalBody className="pad changelog">
            <div style={{maxWidth: '32rem', margin: 'auto'}}>
              {message ? (
                <Nl2Br className="notice info">{message}</Nl2Br>
              ) : null}
              <div>
                <div className="pad-left-sm">
                  <div className="inline-block text-center"
                       style={{width: '50%'}}>
                    <input
                      id="plan-plus-monthly-1"
                      type="radio"
                      name="payment-cycle"
                      checked={selectedPlan === 'plus-monthly-1'}
                      onChange={e => this._handlePlanChange('plus-monthly-1')}
                    />
                    &nbsp;&nbsp;
                    <label htmlFor="plan-plus-monthly-1">
                      Per Month ($5/mo)
                    </label>
                  </div>
                  <div className="inline-block text-center"
                       style={{width: '50%'}}>
                    <input
                      id="plan-plus-yearly-1"
                      type="radio"
                      name="payment-cycle"
                      checked={selectedPlan === 'plus-yearly-1'}
                      onChange={e => this._handlePlanChange('plus-yearly-1')}
                    />
                    &nbsp;&nbsp;
                    <label htmlFor="plan-plus-yearly-1">Annual ($50/yr)</label>
                  </div>
                </div>
              </div>

              <div className="pad-top">
                <label htmlFor="payment-name">Full name</label>
                <div className="form-control form-control--outlined">
                  <input type="text"
                         required="required"
                         id="payment-name"
                         name="payment-name"
                         placeholder="Paula Jones"
                         defaultValue={session.getFullName()}
                         ref={n => this._nameInput = n}/>
                </div>
              </div>

              <div>
                <label htmlFor="payment-card-number">
                  Card Number {cardType ? `(${cardType})` : ''}
                </label>
                <div className="form-control form-control--outlined">
                  <input type="text"
                         required="required"
                         id="payment-card-number"
                         placeholder="4012 8888 8888 1881"
                         onChange={this._handleCreditCardNumberChange.bind(this)}
                         ref={n => this._cardNumberInput = n}/>
                </div>
              </div>

              <div>
                <div className="inline-block" style={{width: '66%'}}>
                  <label htmlFor="payment-expiry">
                    Expiration Date
                  </label>
                  <div className="pad-left-sm pad-top-sm">
                    <select name="payment-expiration-month"
                            id="payment-expiration-month"
                            ref={n => this._expiryMonthInput = n}>
                      {MONTHS.map(({name, value}) => (
                        <option key={value} value={value}>
                          {value} – {name}</option>
                      ))}
                    </select>
                    {" "}
                    <select name="payment-expiration-year"
                            id="payment-expiration-year"
                            ref={n => this._expiryYearInput = n}>
                      {YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="inline-block" style={{width: '34%'}}>
                  <label htmlFor="payment-cvc">Security Code (CVC)</label>
                  <div className="form-control form-control--outlined">
                    <input type="text"
                           maxLength="4"
                           required="required"
                           id="payment-cvc"
                           name="payment-cvc"
                           placeholder="013"
                           onChange={this._handleCreditCardCvcChange.bind(this)}
                           ref={n => this._cvcInput = n}/>
                  </div>
                </div>
              </div>

              {this.state.error ? (
                <div className="danger pad-top">** {this.state.error}</div>
              ) : null}
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="margin-left faint italic txt-sm">
              * Payments secured and managed by
              {" "}
              <Link href="https://stripe.com">Stripe</Link>
            </div>
            {this.state.loading ? (
              <button type="submit" className="btn">
                <i className="fa fa-spin fa-refresh margin-right-sm"></i>
                {" "}
                Processing
              </button>
            ) : (
              <button type="submit" className="btn">
                Submit Details
              </button>
            )}
          </ModalFooter>
        </Modal>
      </form>
    )
  }
}

PaymentModal.propTypes = {};

export default PaymentModal;
