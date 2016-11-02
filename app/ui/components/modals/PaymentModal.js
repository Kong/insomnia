import React, {Component} from 'react';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';

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
  constructor (props) {
    super(props);
    this.state = {
      error: '',
      loading: false,
      cardType: '',
      selectedPlan: 'plus-monthly-1'
    }
  }

  show () {
    this.setState({error: ''});
    this.modal.show();
    setTimeout(() => this._nameInput.focus(), 100);
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

    const lastChar = value[e.target.value.length - 1];
    const num = value.replace(/[^0-9]*/g, '');
    const g1 = num.slice(0, 4);
    const g2 = num.slice(4, 8);
    const g3 = num.slice(8, 12);
    const g4 = num.slice(12, 16);

    let newNum = g1;
    newNum += g2 ? `-${g2}` : '';
    newNum += g3 ? `-${g3}` : '';
    newNum += g4 ? `-${g4}` : '';

    // Handle trailing dash so we can add and delete dashes properly
    const numNumbers = (g1 + g2 + g3 + g4).length;
    if (lastChar === '-' && g4.length !== 4 && numNumbers % 4 === 0) {
      newNum += '-';
    }

    const cardType = Stripe.card.cardType(newNum);
    this.setState({cardType: cardType === 'Unknown' ? '' : cardType});

    e.target.value = newNum;
  }

  _handleSubmit (e) {
    e.preventDefault();

    this.setState({error: '', loading: true});

    const params = {
      name: this._nameInput.value,
      number: this._cardNumberInput.value.replace(/-/g, ''),
      cvc: this._cvcInput.value,
      exp_month: parseInt(this._expiryMonthInput.value, 10),
      exp_year: parseInt(this._expiryYearInput.value, 10),
    };

    Stripe.card.createToken(params, async (status, response) => {
      if (status === 200) {
        try {
          await session.subscribe(response.id, this.state.selectedPlan);
          this.setState({error: '', loading: false});
        } catch (e) {
          this.setState({error: e.message, loading: false});
        }
      } else {
        this.setState({error: response.error.message, loading: false});
      }
    });
  }

  render () {
    const {selectedPlan, cardType} = this.state;

    return (
      <Modal ref={m => this.modal = m} {...this.props}>
        <form onSubmit={this._handleSubmit.bind(this)}>
          <ModalHeader>Enter Payment Method</ModalHeader>
          <ModalBody className="pad changelog">
            <div style={{maxWidth: '30rem', margin: 'auto'}}>
              <div>
                <label htmlFor="payment-cycle">Billing Cycle</label>
                <div className="pad-left-half pad-top-sm">
                  <div className="inline-block" style={{width: '50%'}}>
                    <input
                      id="plan-plus-monthly-1"
                      type="radio"
                      name="payment-cycle"
                      checked={selectedPlan === 'plus-monthly-1'}
                      onChange={e => this._handlePlanChange('plus-monthly-1')}
                    />
                    &nbsp;&nbsp;
                    <label htmlFor="plan-plus-monthly-1">Per Month
                      ($5/mo)</label>
                  </div>
                  <div className="inline-block" style={{width: '50%'}}>
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

              <div className="pad-top">
                <label htmlFor="payment-card-number">
                  Card Number {cardType ? `(${cardType})` : ''}
                </label>
                <div className="form-control form-control--outlined">
                  <input type="text"
                         required="required"
                         pattern=".{19,20}"
                         id="payment-card-number"
                         placeholder="4242-4242-4242-4242"
                         onChange={this._handleCreditCardNumberChange.bind(this)}
                         ref={n => this._cardNumberInput = n}/>
                </div>
              </div>

              <div>
                <div className="inline-block" style={{width: '66%'}}>
                  <label htmlFor="payment-expiry">
                    Expiration Date
                  </label>
                  <div className="pad-top-sm pad-left-half">
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

                <div className="pad-top inline-block" style={{width: '34%'}}>
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
            <button type="submit" className="btn">
              {this.state.loading ? (
                <i className="fa fa-spin fa-refresh margin-right-sm"></i>
              ) : null} Submit Details
            </button>
          </ModalFooter>
        </form>
      </Modal>
    )
  }
}

PaymentModal.propTypes = {};

export default PaymentModal;
