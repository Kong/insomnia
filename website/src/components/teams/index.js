import React, {Component, PropTypes} from 'react';
import LeaveTeamLink from './leave-link';
import RemoveTeamAccountLink from './remove-account-link';
import UpdateTeamNameForm from './update-name-form';
import AddAccountToTeamForm from './add-account-form';

class Teams extends Component {
  state = {
    loading: false,
    error: '',
  };

  _getOwnedTeam () {
    const {teams, whoami} = this.props;
    return teams.find(t => t.ownerAccountId === whoami.accountId);
  };

  renderEditTeam () {
    const {whoami, billingDetails} = this.props;
    const ownedTeam = this._getOwnedTeam();

    let membersRemaining = 0;

    if (billingDetails && ownedTeam) {
      membersRemaining = billingDetails.subQuantity - ownedTeam.accounts.length;
    } else if (whoami.isTrialing && ownedTeam) {
      membersRemaining = 5 - ownedTeam.accounts.length;
    }

    let inner = null;
    if (!whoami.isTrialing && !whoami.canManageTeams) {
      inner = (
        <div>
          <p>Manage who is on your team.</p>
          <p className="notice info">
            <strong>Upgrade to Teams</strong> to manage your own team
            <br/><br/>
            <a href="/app/subscribe/#teams" className="button button--compact">
              Upgrade to Teams
            </a>
          </p>
        </div>
      )
    } else if (ownedTeam) {
      const {handleReload} = this.props;

      // Sort the accounts to put the user first. NOTE: We're making a copy since
      // sort modifies the original.
      const accounts = [...ownedTeam.accounts].sort((a, b) =>
        a.id === whoami.accountId ? -1 : 1
      );

      inner = (
        <div>
          <p>Manage who is on <strong>{ownedTeam.name}</strong>.</p>
          <UpdateTeamNameForm
            onUpdate={handleReload}
            teamId={ownedTeam.id}
            teamName={ownedTeam.name}
          />
          <AddAccountToTeamForm
            key={membersRemaining}
            onAdd={handleReload}
            teamId={ownedTeam.id}
            membersRemaining={membersRemaining}
          />
          <div className="form-control">
            <label>Team Members
              <ul>
                {accounts.map(account => (
                  <li key={account.id}>
                    {account.firstName} {account.lastName}
                    {" "}
                    <small>({account.email})</small>
                    {" "}
                    {account.id !== whoami.accountId ? (
                      <RemoveTeamAccountLink onRemove={this.props.handleReload}
                                             teamId={ownedTeam.id}
                                             teamName={ownedTeam.name}
                                             className="small pull-right"
                                             accountId={account.id}
                                             accountName={`${account.firstName} ${account.lastName}`.trim()}>
                        remove
                      </RemoveTeamAccountLink>
                    ) : (
                      <strong className="small pull-right">(you)</strong>
                    )}
                  </li>
                ))}
              </ul>
            </label>
          </div>
        </div>
      )
    } else {
      // This should never happen...
      inner = (
        <p className="notice info">
          Uh oh! Your account does not have a default team. Please
          contact <strong>support@insomnia.rest</strong>
        </p>
      )
    }

    return (
      <div>
        <h2>Your Team</h2>
        {inner}
      </div>
    )
  }

  renderTeams () {
    const {teams, whoami} = this.props;

    return (
      <div>
        <h2>Teams You're On</h2>
        <p>
          These are the teams you've been invited to.
        </p>
        {teams.length ? (
          <ul>
            {teams.map(team => (
              <li key={team.id}>
                {team.name}
                {" "}
                {team.ownerAccountId === whoami.accountId ? (
                  <span className="small pull-right">(your team)</span>
                ) : (
                  <LeaveTeamLink onLeave={this.props.handleReload}
                                 teamId={team.id}
                                 teamName={team.name}
                                 className="small pull-right">
                    leave
                  </LeaveTeamLink>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="info notice">
            You are not on any teams yet.
          </p>
        )}
      </div>
    )
  }

  render () {
    const {loading} = this.state;

    if (loading) {
      return <div>Loading...</div>
    }
    return (
      <div>
        {this.renderEditTeam()}
        <hr/>
        {this.renderTeams()}
      </div>
    )
  }
}

Teams.propTypes = {
  handleReload: PropTypes.func.isRequired,
  whoami: PropTypes.shape({
    accountId: PropTypes.string.isRequired,
    firstName: PropTypes.string.isRequired,
    lastName: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    canManageTeams: PropTypes.bool.isRequired,
  }).isRequired,
  billingDetails: PropTypes.shape({
    subQuantity: PropTypes.number.isRequired,
  }),
  teams: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    ownerAccountId: PropTypes.string.isRequired,
    accounts: PropTypes.arrayOf(PropTypes.shape({
      firstName: PropTypes.string.isRequired,
      lastName: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
    })).isRequired,
  })).isRequired,
};

export default Teams;
