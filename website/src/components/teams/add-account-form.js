import React, {Component, PropTypes} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

class AddTeamAccountForm extends Component {
  constructor (props) {
    super(props);

    this.state = {
      password: '',
      loading: false,
      newMemberEmail: '',
      error: '',
    };
  }

  _handleUpdateInput = e => {
    this.setState({[e.target.name]: e.target.value, error: ''});
  };

  _handleSubmit = async e => {
    e.preventDefault();

    const {teamId, onAdd} = this.props;
    const {newMemberEmail} = this.state;

    this.setState({loading: true});

    try {
      await session.inviteToTeam(teamId, newMemberEmail, this.state.password);
      await onAdd();
      this.setState({loading: false});
      trackEvent('Teams', 'Add Member Success');
    } catch (err) {
      this.setState({error: err.message, loading: false});
      trackEvent('Teams', 'Add Member Error');
    }
  };

  render () {
    const {membersRemaining} = this.props;
    const {loading, error} = this.state;
    return (
      <form onSubmit={this._handleSubmit}>
        <strong>{error ? <small className="error">({error})</small> : null}</strong>
        <div className="form-row">
          <div className="form-control">
            <label>Add by Email
              {" "}
              <small>({membersRemaining} remaining)</small>
              <input type="email"
                     placeholder="amy@company.com"
                     name="newMemberEmail"
                     onChange={this._handleUpdateInput}
                     required/>
            </label>
          </div>
          <div className="form-control">
            <label>Your Password
              <input type="password"
                     placeholder="•••••••••••••"
                     name="password"
                     onChange={this._handleUpdateInput}
                     required/>
            </label>
          </div>
          <div className="form-control form-control--no-label width--auto">
            {loading ?
              <button type="button" disabled className="button">Inviting...</button> :
              <button type="submit" className="button">Add</button>
            }
          </div>
        </div>
      </form>
    );
  }
}

AddTeamAccountForm.propTypes = {
  onAdd: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  membersRemaining: PropTypes.number.isRequired,
};

export default AddTeamAccountForm;
