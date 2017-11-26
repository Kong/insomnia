import React, {Component, PropTypes} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

class UpdateTeamNameForm extends Component {
  constructor (props) {
    super(props);

    this.state = {
      loading: false,
      teamName: props.teamName,
      error: '',
    };
  }

  _handleUpdateInput = e => {
    this.setState({[e.target.name]: e.target.value, error: ''});
  };

  _handleSubmit = async e => {
    e.preventDefault();

    const {teamId, onUpdate} = this.props;
    const {teamName} = this.state;

    this.setState({loading: true});

    try {
      await session.changeTeamName(teamId, teamName);
      await onUpdate();
      trackEvent('Teams', 'Update Name Success');
    } catch (err) {
      alert(`Failed to leave team: ${err.message}`);
      trackEvent('Teams', 'Update Name Error');
    }

    this.setState({loading: false});
  };

  render () {
    const {teamName} = this.props;
    const {loading, error} = this.state;
    return (
      <form onSubmit={this._handleSubmit}>
        <div className="form-row">
          <div className="form-control">
            <label>Team Name
              <input type="text"
                     name="teamName"
                     placeholder="Mud Dogs"
                     defaultValue={teamName}
                     onChange={this._handleUpdateInput}
                     required/>
            </label>
          </div>

          {error ? <small className="form-control error">({error})</small> : null}

          <div className="form-control form-control--no-label width--auto">
            {loading ?
              <button type="button" className="button" disabled>Updating...</button> :
              <button type="submit" className="button">Update</button>}
          </div>
        </div>
      </form>
    );
  }
}

UpdateTeamNameForm.propTypes = {
  onUpdate: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  teamName: PropTypes.string.isRequired,
};

export default UpdateTeamNameForm;
