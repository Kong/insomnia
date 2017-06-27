import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import EnvironmentsModal from '../modals/workspace-environments-edit-modal';
import {Dropdown, DropdownButton, DropdownDivider, DropdownHint, DropdownItem} from '../base/dropdown';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';
import Tooltip from '../tooltip';

@autobind
class EnvironmentsDropdown extends PureComponent {
  _handleActivateEnvironment (environmentId) {
    this.props.handleChangeEnvironment(environmentId);
    trackEvent('Environment', environmentId ? 'Activate' : 'Deactivate');
  }

  _handleShowEnvironmentModal () {
    showModal(EnvironmentsModal, this.props.workspace);
  }

  renderEnvironmentItem (environment) {
    return (
      <DropdownItem key={environment._id}
                    value={environment._id}
                    onClick={this._handleActivateEnvironment}>
        <i className="fa fa-random" style={{color: environment.color}}/>
        Use <strong>{environment.name}</strong>
      </DropdownItem>
    );
  }

  render () {
    const {
      className,
      workspace,
      environments,
      activeEnvironment,
      ...other
    } = this.props;

    // NOTE: Base environment might not exist if the users hasn't managed environments yet.
    const baseEnvironment = environments.find(e => e.parentId === workspace._id);
    const subEnvironments = environments.filter(
      e => e.parentId === (baseEnvironment && baseEnvironment._id)
    );

    let description;
    if (!activeEnvironment || activeEnvironment === baseEnvironment) {
      description = 'No Environment';
    } else {
      description = activeEnvironment.name;
    }

    return (
      <Dropdown {...other} className={className}>
        <DropdownButton className="btn btn--super-compact no-wrap">
          <div className="sidebar__menu__thing">
            {(!activeEnvironment && subEnvironments.length > 0) && (
              <Tooltip message="No environments active. Please select one to use."
                       className="space-right"
                       position="right">
                <i className="fa fa-exclamation-triangle notice"/>
              </Tooltip>
            )}
            <div className="sidebar__menu__thing__text">
              {activeEnvironment && (
                <i className="fa fa-circle space-right" style={{color: activeEnvironment.color}}/>
              )}
              {description}
            </div>
            <i className="space-left fa fa-caret-down"/>
          </div>
        </DropdownButton>

        <DropdownDivider>Activate Environment</DropdownDivider>
        {subEnvironments.map(this.renderEnvironmentItem)}

        <DropdownItem value={null} onClick={this._handleActivateEnvironment}>
          <i className="fa fa-empty"/> No Environment
        </DropdownItem>

        <DropdownDivider>General</DropdownDivider>

        <DropdownItem onClick={this._handleShowEnvironmentModal}>
          <i className="fa fa-wrench"/> Manage Environments
          <DropdownHint char="E"/>
        </DropdownItem>
      </Dropdown>
    );
  }
}

EnvironmentsDropdown.propTypes = {
  // Functions
  handleChangeEnvironment: PropTypes.func.isRequired,

  // Other
  workspace: PropTypes.object.isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  activeEnvironment: PropTypes.object,
  className: PropTypes.string
};

export default EnvironmentsDropdown;
