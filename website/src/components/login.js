import React, {Component, PropTypes} from 'react';

import * as session from '../session';
import {trackEvent} from '../analytics';

class Login extends Component {
  state = {
    loading: false,
    email: '',
    password: '',
    error: '',
  };

  _handleUpdateInput = e => {
    this.setState({[e.target.name]: e.target.value, error: ''});
  };

  _handleSubmit = async e => {
    e.preventDefault();

    this.setState({loading: true});

    try {
      await session.login(this.state.email, this.state.password);

      const nextUrl = localStorage.getItem('login.next') || '/app/account/';
      localStorage.removeItem('login.next');

      window.location = nextUrl;
      trackEvent('Account', 'Login Success');
    } catch (err) {
      this.setState({error: err.message, loading: false});
      trackEvent('Account', 'Login Error');
    }
  };

  render () {
    const {loading, error} = this.state;

    return (
      <form onSubmit={this._handleSubmit} method="POST">
        <div className="form-control">
          <label>Email Address
            <input type="email"
                   name="email"
                   placeholder="name@domain.com"
                   onChange={this._handleUpdateInput}
                   autoFocus
                   required/>
          </label>
        </div>
        <div className="form-control">
          <label>Password
            <input type="password"
                   name="password"
                   onChange={this._handleUpdateInput}
                   placeholder="•••••••••••••"
                   required/>
          </label>
        </div>
        {error ? <small className="form-control error">** {error}</small> : null}
        <div className="form-row padding-top-sm">
          <div className="form-control">
            Or, <a href="/app/signup">Sign Up</a>
          </div>
          <div className="form-control right">
            {loading ?
              <button type="button" disabled className="button">Logging In...</button> :
              <button type="submit" className="button">Log In</button>
            }
          </div>
        </div>
        <hr className="hr--skinny"/>
        <p className="center text-sm">
          <a href="/documentation/forgot-password/" target="_blank">Forgot your password?</a>
        </p>
      </form>
    )
  }
}

Login.propTypes = {};

export default Login;
