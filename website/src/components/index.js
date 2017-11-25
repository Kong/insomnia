import React, {Component, PropTypes} from 'react';
import Home from './home';
import Login from './login';
import SignUp from './signup';
import Subscribe from './subscribe';
import Teams from './teams';
import ChangePassword from './change-password';
import ChangeEmail from './change-email';
import * as session from '../session';
import {setUserId} from '../analytics';

class App extends Component {
  state = {loading: true};
  component = null;

  _handleReload = async () => {
    let whoami;

    const whoamiTask = session.whoami();
    const billingDetailsTask = session.billingDetails();
    const teamsTask = session.listTeams();

    // Fetch Account info
    try {
      whoami = await whoamiTask;
    } catch (err) {
      // If not logged in, logout and redirect to login page
      if (err.statusCode === 403) {
        await session.logout();
      }

      localStorage.setItem('login.next', window.location.href);
      window.location = '/app/signup/';
      return;
    }

    setUserId(whoami.accountId);

    // Fetch the things
    const teams = await teamsTask;
    const billingDetails = await billingDetailsTask;

    const path = window.location.pathname;
    if (path.match(/^\/app\/account\/$/)) {
      this.component = <Home whoami={whoami} billingDetails={billingDetails}/>
    } else if (path.match(/^\/app\/subscribe\/$/)) {
      this.component = <Subscribe whoami={whoami} billingDetails={billingDetails}/>
    } else if (path.match(/^\/app\/change-password\/$/)) {
      this.component = <ChangePassword whoami={whoami}/>
    } else if (path.match(/^\/app\/change-email\/$/)) {
      this.component = <ChangeEmail whoami={whoami}/>
    } else if (path.match(/^\/app\/teams\/$/)) {
      this.component = (
        <Teams
          whoami={whoami}
          billingDetails={billingDetails}
          teams={teams}
          handleReload={this._handleReload}
        />
      )
    }

    // Give some time for components waiting on this to finish to update their
    // state before we refresh on them.
    setTimeout(() => {
      this.setState({loading: false});
    }, 0)
  };

  componentWillMount () {
    const {path} = this.props;

    // Routes that don't require session
    if (path === '/app/login/') {
      this.component = <Login/>;
    } else if (path === '/app/signup/') {
      this.component = <SignUp/>;
    }

    // Show one of the above components
    if (this.component) {
      this.setState({loading: false});
    } else {
      this._handleReload();
    }
  }

  render () {
    if (this.component) {
      return this.component;
    }

    if (this.state.loading) {
      return (
        <div className="center text-lg subtle">
          Loading...
        </div>
      )
    } else {
      return <div>Page Not Found</div>;
    }
  }
}

App.propTypes = {
  path: PropTypes.string.isRequired
};

export default App;
