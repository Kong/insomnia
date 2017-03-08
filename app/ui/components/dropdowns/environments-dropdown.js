import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';
import EnvironmentsModal from '../modals/workspace-environments-edit-modal';
import {Dropdown, DropdownDivider, DropdownButton, DropdownItem, DropdownHint} from '../base/dropdown';
import {showModal} from '../modals/index';
import {trackEvent} from '../../../analytics/index';

class EnvironmentsDropdown extends PureComponent {
  render () {
    const {
      className,
      workspace,
      environments,
      activeEnvironment,
      handleChangeEnvironment,
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
      <Dropdown {...other} className={classnames(className, 'wide')}>
        <DropdownButton className="btn btn--super-compact no-wrap">
          <div className="sidebar__menu__thing">
            <span>{description}</span>
            {' '}
            <i className="fa fa-caret-down"/>
          </div>
        </DropdownButton>
        <DropdownDivider>Switch Environment</DropdownDivider>
        {subEnvironments.map(environment => (
          <DropdownItem key={environment._id}
                        onClick={e => {
                          handleChangeEnvironment(environment._id);
                          trackEvent('Environment', 'Activate');
                        }}>
            <i className="fa fa-random"/> Use <strong>{environment.name}</strong>
          </DropdownItem>
        ))}
        <DropdownItem onClick={() => {
          baseEnvironment && handleChangeEnvironment(null);
          trackEvent('Environment', 'Deactivate');
        }}>
          <i className="fa fa-empty"/> No Environment
        </DropdownItem>
        <DropdownDivider>General</DropdownDivider>
        <DropdownItem onClick={e => showModal(EnvironmentsModal, workspace)}>
          <i className="fa fa-wrench"></i> Manage Environments
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
